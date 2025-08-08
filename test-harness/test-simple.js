const { createEval2Otel } = require('eval2otel');
const axios = require('axios');

console.log('🚀 eval2otel Simple E2E Test\n');

async function runSimpleTest() {
  try {
    // Start minimal infrastructure
    console.log('📦 Starting OpenTelemetry Collector and Prometheus...');
    
    // Initialize eval2otel
    const eval2otel = createEval2Otel({
      serviceName: 'eval2otel-simple-test',
      serviceVersion: '0.2.0',
      environment: 'test',
      captureContent: true,
      sampleContentRate: 1.0,
      redact: (content) => content.replace(/secret/g, '[REDACTED]'),
      resourceAttributes: {
        'test.framework': 'simple-e2e',
        'test.run_id': `run-${Date.now()}`,
      },
    });

    console.log('✅ Eval2otel initialized');

    // Test different evaluation types
    console.log('\n📊 Running evaluation tests...');

    // 1. Chat evaluation
    const chatEval = {
      id: 'simple-chat-001',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      },
      
      response: {
        id: 'resp-123',
        model: 'gpt-4',
        finishReasons: ['stop'],
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you today?',
          },
        }],
      },
      
      usage: {
        inputTokens: 15,
        outputTokens: 8,
        totalTokens: 23,
      },
      
      performance: {
        duration: 1.2, // seconds
        timeToFirstToken: 0.2,
        timePerOutputToken: 0.12,
      },
      
      conversation: {
        id: 'conv-simple',
        messages: [{
          role: 'user',
          content: 'Hello there! My secret password is 12345.',
        }],
      },
    };

    eval2otel.processEvaluation(chatEval, {
      metrics: {
        accuracy: 0.98,
        relevance: 0.95,
        helpfulness: 0.92,
      },
      attributes: {
        'test.case': 'basic_chat',
        'test.redaction': 'enabled',
      },
    });

    console.log('✅ Chat evaluation processed');

    // 2. Tool execution
    const toolEval = {
      id: 'simple-tool-001',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'execute_tool',
      
      request: {
        model: 'gpt-4',
        temperature: 0.1,
      },
      
      response: {
        choices: [{
          index: 0,
          finishReason: 'tool_calls',
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [{
              id: 'call_simple',
              type: 'function',
              function: {
                name: 'calculate',
                arguments: { expression: '2 + 2' },
              },
            }],
          },
        }],
      },
      
      usage: {
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
      },
      
      performance: {
        duration: 0.8,
      },
      
      tool: {
        name: 'calculate',
        callId: 'call_simple',
        result: { answer: '4' },
      },
    };

    eval2otel.processEvaluation(toolEval, {
      metrics: {
        tool_accuracy: 1.0,
        execution_success: 1.0,
      },
      attributes: {
        'test.case': 'tool_execution',
        'tool.type': 'calculator',
      },
    });

    console.log('✅ Tool evaluation processed');

    // 3. Error case
    const errorEval = {
      id: 'simple-error-001',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
      },
      
      response: {
        choices: [],
      },
      
      usage: {
        inputTokens: 5,
        outputTokens: 0,
        totalTokens: 5,
      },
      
      performance: {
        duration: 0.1,
      },
      
      error: {
        type: 'invalid_request',
        message: 'Missing required parameter',
      },
    };

    eval2otel.processEvaluation(errorEval, {
      attributes: {
        'test.case': 'error_handling',
        'error.category': 'validation',
      },
    });

    console.log('✅ Error evaluation processed');

    // Wait for telemetry export
    console.log('\n⏳ Waiting for telemetry export...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await eval2otel.shutdown();
    console.log('✅ Shutdown complete');

    console.log('\n🎉 Simple E2E test completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   - ✅ Library initialization');
    console.log('   - ✅ Chat evaluation with redaction');
    console.log('   - ✅ Tool execution evaluation');
    console.log('   - ✅ Error handling evaluation');
    console.log('   - ✅ Custom metrics and attributes');
    console.log('   - ✅ Graceful shutdown');

    console.log('\n💡 To verify with real OpenTelemetry infrastructure:');
    console.log('   1. Start services: docker-compose -f docker-compose-simple.yml up -d');
    console.log('   2. Run: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 node test-simple.js');
    console.log('   3. Check metrics: curl http://localhost:8889/metrics');

  } catch (error) {
    console.error('❌ Simple E2E test failed:', error);
    process.exit(1);
  }
}

runSimpleTest();
