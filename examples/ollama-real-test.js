const { createEval2Otel, convertOllamaToEval2Otel } = require('../dist/index.js');
const axios = require('axios');

/**
 * Real integration test with actual Ollama instance
 * Prerequisites:
 * 1. ollama serve (running on localhost:11434)
 * 2. ollama pull llama3.2 (or another model)
 */
async function testWithRealOllama() {
  console.log('🦙 Testing eval2otel with REAL Ollama instance...');
  
  // Check if Ollama is running
  try {
    const healthCheck = await axios.get('http://localhost:11434/api/version', { timeout: 5000 });
    console.log('✅ Ollama is running:', healthCheck.data);
  } catch (error) {
    throw new Error(`❌ Ollama not accessible: ${error.message}\nMake sure to run: ollama serve`);
  }

  // Initialize eval2otel
  const eval2otel = createEval2Otel({
    serviceName: 'ollama-real-test',
    serviceVersion: '1.0.0',
    environment: 'test',
    captureContent: true,
    sampleContentRate: 1.0,
    endpoint: 'http://localhost:4317',
    exporterProtocol: 'grpc',
  });

  try {
    // Test 1: Simple chat with real Ollama
    console.log('\n📝 Test 1: Basic chat completion');
    
    const chatRequest = {
      model: 'llama3.2', // Make sure this model is pulled
      messages: [
        { role: 'user', content: 'What is the capital of France? Answer in one sentence.' }
      ],
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 50,
      }
    };

    console.log('📤 Sending request to Ollama:', JSON.stringify(chatRequest, null, 2));

    const startTime = Date.now();
    const response = await axios.post('http://localhost:11434/api/chat', chatRequest, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('📥 Received response from Ollama');
    console.log('Response message:', response.data.message);
    console.log('Performance metrics:', {
      total_duration: response.data.total_duration,
      load_duration: response.data.load_duration,
      prompt_eval_count: response.data.prompt_eval_count,
      eval_count: response.data.eval_count,
    });

    // Convert real Ollama response to eval2otel format
    const evalResult = convertOllamaToEval2Otel(
      { ...chatRequest, ...chatRequest.options }, 
      response.data, 
      startTime, 
      {
        evalId: 'real-ollama-test-001',
        conversationId: 'real-test-conv-001',
        conversationMessages: [
          chatRequest.messages[0],
          response.data.message
        ],
      }
    );

    console.log('🔄 Converted to eval2otel format');

    // Process with eval2otel
    eval2otel.processEvaluation(evalResult, {
      metrics: {
        response_accuracy: 1.0, // Manually assessed
        response_completeness: 0.9,
        response_time: (response.data.total_duration || 0) / 1e9, // Convert nanoseconds to seconds
      },
      attributes: {
        'test.type': 'real_ollama_integration',
        'model.local': 'true',
        'model.framework': 'ollama',
        'ollama.version': response.headers['ollama-version'] || 'unknown',
      },
    });

    console.log('✅ Test 1 completed successfully');

    // Test 2: OpenAI-compatible endpoint (if available)
    console.log('\n📝 Test 2: OpenAI-compatible endpoint');
    
    try {
      const openaiRequest = {
        model: 'llama3.2',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is OpenTelemetry? Keep it brief.' }
        ],
        temperature: 0.3,
        max_tokens: 100,
      };

      const startTime2 = Date.now();
      const openaiResponse = await axios.post('http://localhost:11434/v1/chat/completions', openaiRequest, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      const endTime2 = Date.now();

      console.log('📥 OpenAI-compatible response:', openaiResponse.data.choices[0].message);

      // Use OpenAI-compatible converter
      const { convertOpenAICompatibleToEval2Otel } = require('../dist/index.js');
      const evalResult2 = convertOpenAICompatibleToEval2Otel(
        openaiRequest,
        openaiResponse.data,
        startTime2,
        endTime2,
        { system: 'ollama', evalId: 'real-ollama-openai-001' }
      );

      eval2otel.processEvaluation(evalResult2, {
        metrics: {
          explanation_clarity: 0.88,
          technical_accuracy: 0.95,
        },
        attributes: {
          'test.type': 'real_ollama_openai_compat',
          'api.format': 'openai_compatible',
        },
      });

      console.log('✅ Test 2 completed successfully');
    } catch (openaiError) {
      console.log('⚠️  OpenAI-compatible endpoint not available:', openaiError.message);
    }

    // Allow telemetry to be exported
    console.log('\n⏳ Waiting for telemetry export...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await eval2otel.shutdown();
    console.log('✅ eval2otel shutdown complete');

    console.log('\n🎉 Real Ollama integration test completed successfully!');
    console.log('\n📊 To view telemetry data:');
    console.log('   - Start the test harness: cd test-harness && docker compose up -d');
    console.log('   - Jaeger UI: http://localhost:16686');
    console.log('   - Look for service: ollama-real-test');

  } catch (error) {
    console.error('❌ Real Ollama test failed:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to check available models
async function listAvailableModels() {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    console.log('📋 Available Ollama models:');
    response.data.models.forEach(model => {
      console.log(`   - ${model.name} (${model.size} bytes, modified: ${model.modified_at})`);
    });
    return response.data.models.map(m => m.name);
  } catch (error) {
    console.error('❌ Could not list models:', error.message);
    return [];
  }
}

// Export functions
module.exports = {
  testWithRealOllama,
  listAvailableModels,
};

// Run test if executed directly
if (require.main === module) {
  (async () => {
    try {
      await listAvailableModels();
      await testWithRealOllama();
    } catch (error) {
      console.error('\n💥 Test failed:', error.message);
      console.log('\n🔧 Make sure:');
      console.log('   1. Ollama is running: ollama serve');
      console.log('   2. You have a model: ollama pull llama3.2');
      console.log('   3. OpenTelemetry collector is available (optional)');
      process.exit(1);
    }
  })();
}