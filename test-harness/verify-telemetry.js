const axios = require('axios');

async function verifyTelemetryDetailed() {
  console.log('🔍 Detailed Telemetry Verification\n');

  try {
    // 1. Check Jaeger traces
    console.log('📊 Checking Jaeger traces...');
    const servicesResponse = await axios.get('http://localhost:16686/api/services');
    const services = servicesResponse.data.data;
    
    if (services.includes('eval2otel-e2e-test')) {
      console.log('✅ Service found in Jaeger');
      
      // Get traces for our service
      const tracesResponse = await axios.get(
        'http://localhost:16686/api/traces?service=eval2otel-e2e-test&limit=20'
      );
      const traces = tracesResponse.data.data;
      
      console.log(`✅ Found ${traces.length} traces`);
      
      // Analyze trace data
      for (let i = 0; i < Math.min(traces.length, 3); i++) {
        const trace = traces[i];
        const rootSpan = trace.spans[0];
        console.log(`   Trace ${i + 1}: ${rootSpan.operationName} (${rootSpan.duration/1000}μs)`);
        
        // Check for GenAI attributes
        const genAITags = rootSpan.tags.filter(tag => tag.key.startsWith('gen_ai.'));
        console.log(`     GenAI attributes: ${genAITags.length}`);
        
        // Check for events
        if (rootSpan.logs && rootSpan.logs.length > 0) {
          console.log(`     Events: ${rootSpan.logs.length}`);
        }
      }
    } else {
      console.log('❌ No eval2otel service found in Jaeger');
    }

    // 2. Check Prometheus metrics
    console.log('\n📈 Checking Prometheus metrics...');
    const metricsResponse = await axios.get('http://localhost:9090/api/v1/label/__name__/values');
    const allMetrics = metricsResponse.data.data;
    
    const evalMetrics = allMetrics.filter(metric => 
      metric.includes('gen_ai') || metric.includes('eval_')
    );
    
    console.log(`✅ Found ${evalMetrics.length} eval2otel-related metrics:`);
    for (const metric of evalMetrics.slice(0, 10)) {
      console.log(`   - ${metric}`);
    }

    // Query specific metrics
    const testMetrics = [
      'gen_ai_client_operation_duration',
      'gen_ai_client_token_usage_total',
      'eval_custom_metric',
    ];

    for (const metric of testMetrics) {
      try {
        const queryResponse = await axios.get(
          `http://localhost:9090/api/v1/query?query=${metric}`
        );
        const result = queryResponse.data.data.result;
        
        if (result.length > 0) {
          console.log(`✅ ${metric}: ${result.length} series`);
          // Show sample values
          for (let i = 0; i < Math.min(result.length, 2); i++) {
            const series = result[i];
            const labels = Object.entries(series.metric)
              .filter(([k, v]) => k !== '__name__')
              .map(([k, v]) => `${k}="${v}"`)
              .join(', ');
            console.log(`     ${labels}: ${series.value[1]}`);
          }
        } else {
          console.log(`⚠️  ${metric}: No data points found`);
        }
      } catch (error) {
        console.log(`❌ ${metric}: Query failed`);
      }
    }

    // 3. Check OpenTelemetry Collector health
    console.log('\n🔧 Checking OpenTelemetry Collector...');
    const collectorResponse = await axios.get('http://localhost:8889/metrics');
    
    if (collectorResponse.status === 200) {
      const collectorMetrics = collectorResponse.data;
      
      // Look for receiver metrics
      const receiverMetrics = collectorMetrics.split('\n')
        .filter(line => line.includes('otelcol_receiver_accepted'))
        .slice(0, 5);
      
      console.log('✅ Collector is healthy');
      console.log('   Recent receiver activity:');
      for (const metric of receiverMetrics) {
        console.log(`     ${metric}`);
      }
    }

    console.log('\n🎉 Telemetry verification complete!');
    console.log('\n💡 To explore further:');
    console.log('   - Jaeger UI: http://localhost:16686');
    console.log('   - Prometheus: http://localhost:9090');
    console.log('   - Collector metrics: http://localhost:8889/metrics');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.log('\n💡 Make sure the services are running:');
    console.log('   docker-compose up -d');
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyTelemetryDetailed();
}

module.exports = { verifyTelemetryDetailed };
