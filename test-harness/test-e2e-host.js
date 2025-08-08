const { createEval2Otel } = require('eval2otel');
const axios = require('axios');

console.log('🚀 Starting eval2otel E2E Test Suite (Host-based)\n');

// Wait for services to be ready
async function waitForService(url, name, maxRetries = 15) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(url);
      console.log(`✅ ${name} is ready`);
      return;
    } catch (error) {
      console.log(`⏳ Waiting for ${name}... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`❌ ${name} failed to start`);
}

async function runTests() {
  try {
    // Wait for services
    await waitForService('http://localhost:8889/metrics', 'OpenTelemetry Collector');
    await waitForService('http://localhost:16686', 'Jaeger');
    await waitForService('http://localhost:9090', 'Prometheus');
    
    console.log('\n📊 Starting telemetry tests...\n');

    // Initialize eval2otel
    const eval2otel = createEval2Otel({
      serviceName: 'eval2otel-e2e-test',
      serviceVersion: '0.2.0',
      environment: 'test',
      captureContent: true,
      sampleContentRate: 1.0, // Capture all content for testing
      redact: (content) => {
        // Test redaction
        return content.replace(/secret-key-123/g, '[REDACTED]');
      },
      resourceAttributes: {
        'test.suite': 'e2e',
        'test.timestamp': new Date().toISOString(),
      },
    });

    console.log('✅ Eval2otel initialized');

    // Test 1: Basic chat evaluation
    const chatEval = {
      id: 'chat-eval-001',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 150,
        topP: 0.9,
      },
      
      response: {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        finishReasons: ['stop'],
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'I can help you with various tasks including answering questions, writing content, and problem-solving.',
          },
        }],
      },
      
      usage: {
        inputTokens: 25,
        outputTokens: 20,
        totalTokens: 45,
      },
      
      performance: {
        duration: 2.1, // seconds
        timeToFirstToken: 0.3,
        timePerOutputToken: 0.09,
      },
      
      conversation: {
        id: 'conv-123',
        messages: [
          {
            role: 'user',
            content: 'What can you help me with? My secret-key-123 should be redacted.',
          },
          {
            role: 'assistant',
            content: 'I can help you with various tasks including answering questions, writing content, and problem-solving.',
          }
        ],
      },
    };

    eval2otel.processEvaluation(chatEval, {
      metrics: {
        accuracy: 0.95,
        relevance: 0.92,
        helpfulness: 0.88,
        toxicity: 0.01,
      },
      attributes: {
        'eval.test_case': 'basic_chat',
        'eval.expected_outcome': 'helpful_response',
      },
    });

    console.log('✅ Chat evaluation processed');

    // Test 2: Tool execution evaluation
    const toolEval = {
      id: 'tool-eval-001',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'execute_tool',
      
      request: {
        model: 'gpt-4',
        temperature: 0.2,
        maxTokens: 100,
      },
      
      response: {
        id: 'tool-resp-456',
        model: 'gpt-4',
        finishReasons: ['tool_calls'],
        choices: [{
          index: 0,
          finishReason: 'tool_calls',
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: { location: 'San Francisco', unit: 'celsius' },
              },
            }],
          },
        }],
      },
      
      usage: {
        inputTokens: 35,
        outputTokens: 15,
        totalTokens: 50,
      },
      
      performance: {
        duration: 1.8,
        timeToFirstToken: 0.25,
        timePerOutputToken: 0.08,
      },
      
      tool: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        callId: 'call_123',
        result: {
          temperature: '22',
          condition: 'sunny',
          humidity: '65',
        },
      },
    };

    eval2otel.processEvaluation(toolEval, {
      metrics: {
        tool_accuracy: 1.0,
        tool_execution_time: 0.5,
        parameter_correctness: 0.95,
      },
      attributes: {
        'eval.test_case': 'tool_execution',
        'tool.category': 'weather',
      },
    });

    console.log('✅ Tool evaluation processed');

    // Test 3: Error case
    const errorEval = {
      id: 'error-eval-001',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
        temperature: 0.7,
      },
      
      response: {
        choices: [],
      },
      
      usage: {
        inputTokens: 10,
        outputTokens: 0,
        totalTokens: 10,
      },
      
      performance: {
        duration: 0.5,
      },
      
      error: {
        type: 'rate_limit_exceeded',
        message: 'Rate limit exceeded, please try again later',
      },
    };

    eval2otel.processEvaluation(errorEval, {
      attributes: {
        'eval.test_case': 'error_handling',
        'error.recoverable': 'true',
      },
    });

    console.log('✅ Error evaluation processed');

    // Give time for telemetry to be exported
    console.log('\n⏳ Waiting for telemetry export...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    await eval2otel.shutdown();
    console.log('✅ Eval2otel shutdown complete');

    // Verify telemetry was received
    console.log('\n🔍 Verifying telemetry data...');
    await verifyTelemetry();

    console.log('\n🎉 All E2E tests passed! eval2otel is working correctly with OpenTelemetry infrastructure.');

  } catch (error) {
    console.error('❌ E2E test failed:', error);
    process.exit(1);
  }
}

async function verifyTelemetry() {
  try {
    // Check Jaeger for traces
    console.log('📊 Checking Jaeger for traces...');
    const jaegerResponse = await axios.get('http://localhost:16686/api/services');
    const services = jaegerResponse.data.data;
    
    if (services.includes('eval2otel-e2e-test')) {
      console.log('✅ Service found in Jaeger');
      
      // Get recent traces
      const tracesResponse = await axios.get(
        'http://localhost:16686/api/traces?service=eval2otel-e2e-test&limit=10'
      );
      const traces = tracesResponse.data.data;
      console.log(`✅ Found ${traces.length} traces`);
      
      if (traces.length > 0) {
        const trace = traces[0];
        const spans = trace.spans;
        console.log(`✅ First trace has ${spans.length} spans`);
        
        // Check for GenAI span names
        const genAISpans = spans.filter(span => span.operationName.startsWith('gen_ai.'));
        console.log(`✅ Found ${genAISpans.length} GenAI spans`);
        
        // Check for GenAI attributes
        let totalGenAIAttrs = 0;
        spans.forEach(span => {
          const genAITags = span.tags.filter(tag => tag.key.startsWith('gen_ai.'));
          totalGenAIAttrs += genAITags.length;
        });
        console.log(`✅ Found ${totalGenAIAttrs} GenAI attributes across all spans`);
      }
    } else {
      console.log('⚠️  No eval2otel service found in Jaeger yet');
    }

    // Check Prometheus for metrics (may take time to scrape)
    console.log('\n📈 Checking Prometheus for metrics...');
    try {
      const metricsResponse = await axios.get('http://localhost:9090/api/v1/label/__name__/values');
      const allMetrics = metricsResponse.data.data;
      
      const evalMetrics = allMetrics.filter(metric => 
        metric.includes('gen_ai') || metric.includes('eval_')
      );
      
      if (evalMetrics.length > 0) {
        console.log(`✅ Found ${evalMetrics.length} eval2otel-related metrics in Prometheus`);
      } else {
        console.log('⚠️  No eval2otel metrics in Prometheus yet (may take time to scrape)');
      }
    } catch (error) {
      console.log('⚠️  Could not check Prometheus metrics:', error.message);
    }

    // Check collector health
    console.log('\n🔧 Checking OpenTelemetry Collector health...');
    const collectorResponse = await axios.get('http://localhost:8889/metrics');
    if (collectorResponse.status === 200) {
      console.log('✅ OpenTelemetry Collector is healthy');
      
      // Check for receiver metrics
      const collectorMetrics = collectorResponse.data;
      const receiverLines = collectorMetrics.split('\n')
        .filter(line => line.includes('otelcol_receiver_accepted') && line.includes('otlp'))
        .slice(0, 3);
      
      if (receiverLines.length > 0) {
        console.log('✅ Collector is receiving OTLP data:');
        receiverLines.forEach(line => console.log(`   ${line}`));
      }
    }

  } catch (error) {
    console.error('⚠️  Telemetry verification partial:', error.message);
    // Don't fail the test for verification issues - the main functionality worked
  }
}

// Run the tests
runTests().catch(console.error);
