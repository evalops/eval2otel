const { createEval2Otel, convertOllamaToEval2Otel, convertOpenAICompatibleToEval2Otel } = require('eval2otel');
const axios = require('axios');

console.log('🦙 Starting Ollama Integration Examples\n');

/**
 * Example 1: Using Ollama's native chat API
 */
async function exampleOllamaNativeAPI() {
  console.log('📝 Example 1: Ollama Native Chat API');
  
  const eval2otel = createEval2Otel({
    serviceName: 'ollama-native-example',
    serviceVersion: '1.0.0',
    environment: 'test',
    captureContent: true,
    sampleContentRate: 1.0,
  });

  try {
    // Simulate Ollama chat request
    const request = {
      model: 'llama3.2',
      messages: [
        { role: 'user', content: 'What is the capital of France?' }
      ],
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 100,
    };

    // Simulate Ollama response (in practice, you'd call Ollama API)
    const startTime = Date.now();
    const response = {
      model: 'llama3.2',
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: 'The capital of France is Paris. It is located in the north-central part of the country along the Seine River and has been the capital since 508 CE.',
      },
      done_reason: 'stop',
      done: true,
      total_duration: 2500000000, // 2.5 seconds in nanoseconds
      load_duration: 500000000,   // 0.5 seconds
      prompt_eval_count: 12,
      prompt_eval_duration: 300000000, // 0.3 seconds
      eval_count: 28,
      eval_duration: 1700000000, // 1.7 seconds
    };

    // Convert to eval2otel format
    const evalResult = convertOllamaToEval2Otel(request, response, startTime, {
      evalId: 'ollama-native-001',
      conversationId: 'conv-native-001',
      conversationMessages: [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: response.message.content }
      ],
    });

    // Process with eval2otel
    eval2otel.processEvaluation(evalResult, {
      metrics: {
        response_accuracy: 1.0,
        response_relevance: 0.95,
        response_completeness: 0.9,
      },
      attributes: {
        'example.type': 'ollama_native_chat',
        'model.local': 'true',
        'eval.framework': 'ollama',
      },
    });

    console.log('✅ Ollama native API example processed');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await eval2otel.shutdown();

  } catch (error) {
    console.error('❌ Ollama native API example failed:', error);
  }
}

/**
 * Example 2: Using Ollama's OpenAI-compatible API
 */
async function exampleOllamaOpenAICompatible() {
  console.log('📝 Example 2: Ollama OpenAI-Compatible API');
  
  const eval2otel = createEval2Otel({
    serviceName: 'ollama-openai-compat-example',
    serviceVersion: '1.0.0',
    environment: 'test',
    captureContent: true,
    sampleContentRate: 1.0,
  });

  try {
    // OpenAI-compatible request format
    const request = {
      model: 'mistral',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that explains technical concepts clearly.' },
        { role: 'user', content: 'Explain what OpenTelemetry is in simple terms.' }
      ],
      temperature: 0.3,
      max_tokens: 150,
      top_p: 0.8,
    };

    // Simulate OpenAI-compatible response from Ollama
    const startTime = Date.now();
    const endTime = startTime + 3200; // 3.2 seconds
    const response = {
      id: 'chatcmpl-ollama-001',
      object: 'chat.completion',
      created: Math.floor(startTime / 1000),
      model: 'mistral',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'OpenTelemetry is like a universal translator for monitoring your software. It helps developers collect, process, and export telemetry data (traces, metrics, and logs) from applications in a standardized way, making it easier to understand how your software performs and troubleshoot issues.',
          },
          finish_reason: 'stop',
        }
      ],
      usage: {
        prompt_tokens: 25,
        completion_tokens: 45,
        total_tokens: 70,
      },
    };

    // Convert to eval2otel format
    const evalResult = convertOpenAICompatibleToEval2Otel(request, response, startTime, endTime, {
      evalId: 'ollama-openai-compat-001',
      system: 'ollama',
    });

    // Process with eval2otel
    eval2otel.processEvaluation(evalResult, {
      metrics: {
        explanation_clarity: 0.92,
        technical_accuracy: 0.95,
        conciseness: 0.88,
      },
      attributes: {
        'example.type': 'ollama_openai_compatible',
        'model.local': 'true',
        'eval.framework': 'ollama',
        'response.type': 'explanation',
      },
    });

    console.log('✅ Ollama OpenAI-compatible API example processed');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await eval2otel.shutdown();

  } catch (error) {
    console.error('❌ Ollama OpenAI-compatible API example failed:', error);
  }
}

/**
 * Example 3: Tool execution with Ollama
 */
async function exampleOllamaToolExecution() {
  console.log('📝 Example 3: Ollama Tool Execution');
  
  const eval2otel = createEval2Otel({
    serviceName: 'ollama-tools-example',
    serviceVersion: '1.0.0',
    environment: 'test',
    captureContent: true,
    sampleContentRate: 1.0,
  });

  try {
    const request = {
      model: 'llama3.2',
      messages: [
        { role: 'user', content: 'What\'s the weather like in San Francisco?' }
      ],
      temperature: 0.1,
    };

    const startTime = Date.now();
    const response = {
      model: 'llama3.2',
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            function: {
              name: 'get_weather',
              arguments: { 
                location: 'San Francisco, CA',
                unit: 'fahrenheit'
              },
            },
          }
        ],
      },
      done_reason: 'tool_calls',
      done: true,
      total_duration: 1800000000, // 1.8 seconds
      prompt_eval_count: 15,
      eval_count: 8,
      eval_duration: 400000000, // 0.4 seconds
    };

    // Convert to eval2otel format with tool execution details
    const evalResult = convertOllamaToEval2Otel(request, response, startTime, {
      evalId: 'ollama-tools-001',
      conversationId: 'conv-tools-001',
      toolExecution: {
        name: 'get_weather',
        description: 'Get current weather conditions for a specified location',
        callId: 'call_0',
        result: {
          temperature: 68,
          condition: 'partly cloudy',
          humidity: 72,
          wind_speed: 8,
        },
      },
    });

    // Process with eval2otel
    eval2otel.processEvaluation(evalResult, {
      metrics: {
        tool_selection_accuracy: 1.0,
        parameter_extraction: 0.95,
        tool_execution_time: 0.2,
      },
      attributes: {
        'example.type': 'ollama_tool_execution',
        'tool.category': 'weather',
        'model.local': 'true',
        'eval.framework': 'ollama',
      },
    });

    console.log('✅ Ollama tool execution example processed');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await eval2otel.shutdown();

  } catch (error) {
    console.error('❌ Ollama tool execution example failed:', error);
  }
}

/**
 * Example 4: Local model comparison
 */
async function exampleModelComparison() {
  console.log('📝 Example 4: Local Model Comparison');
  
  const eval2otel = createEval2Otel({
    serviceName: 'ollama-model-comparison',
    serviceVersion: '1.0.0',
    environment: 'test',
    captureContent: true,
    sampleContentRate: 1.0,
  });

  const prompt = 'Write a haiku about artificial intelligence.';
  const models = ['llama3.2', 'mistral', 'phi3'];

  try {
    for (const model of models) {
      const request = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        num_predict: 50,
      };

      // Simulate different model responses and performance
      const startTime = Date.now();
      const responses = {
        'llama3.2': {
          content: 'Silicon minds awake,\nLearning patterns in data,\nFuture dreams unfold.',
          duration: 2200000000, // 2.2 seconds
          eval_count: 18,
        },
        'mistral': {
          content: 'Code breathes and thinks deep,\nAlgorithms dance with thought,\nMachine consciousness.',
          duration: 1800000000, // 1.8 seconds
          eval_count: 16,
        },
        'phi3': {
          content: 'Bytes become wisdom,\nNeural networks dream in code,\nAI\'s gentle touch.',
          duration: 1200000000, // 1.2 seconds
          eval_count: 17,
        },
      };

      const modelResponse = responses[model];
      const response = {
        model: model,
        created_at: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: modelResponse.content,
        },
        done_reason: 'stop',
        done: true,
        total_duration: modelResponse.duration,
        prompt_eval_count: 10,
        eval_count: modelResponse.eval_count,
        eval_duration: modelResponse.duration * 0.8, // ~80% of total time
      };

      const evalResult = convertOllamaToEval2Otel(request, response, startTime, {
        evalId: `model-comparison-${model}-001`,
        conversationId: 'conv-comparison-001',
      });

      // Different quality metrics for each model (simulated)
      const qualityMetrics = {
        'llama3.2': { creativity: 0.85, coherence: 0.92, format_adherence: 1.0 },
        'mistral': { creativity: 0.90, coherence: 0.88, format_adherence: 1.0 },
        'phi3': { creativity: 0.88, coherence: 0.95, format_adherence: 1.0 },
      };

      eval2otel.processEvaluation(evalResult, {
        metrics: {
          ...qualityMetrics[model],
          response_time: modelResponse.duration / 1e9, // Convert to seconds
          tokens_per_second: modelResponse.eval_count / (modelResponse.duration / 1e9),
        },
        attributes: {
          'example.type': 'model_comparison',
          'task.type': 'creative_writing',
          'task.format': 'haiku',
          'model.local': 'true',
          'eval.framework': 'ollama',
          'comparison.group': 'local_models_creative_task',
        },
      });

      console.log(`✅ ${model} evaluation processed`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    await eval2otel.shutdown();
    console.log('✅ Model comparison example completed');

  } catch (error) {
    console.error('❌ Model comparison example failed:', error);
  }
}

// Export for use in test harness
module.exports = {
  exampleOllamaNativeAPI,
  exampleOllamaOpenAICompatible,
  exampleOllamaToolExecution,
  exampleModelComparison,
};

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await exampleOllamaNativeAPI();
      console.log('');
      await exampleOllamaOpenAICompatible();
      console.log('');
      await exampleOllamaToolExecution();
      console.log('');
      await exampleModelComparison();
      console.log('\n🎉 All Ollama examples completed successfully!');
    } catch (error) {
      console.error('❌ Ollama examples failed:', error);
      process.exit(1);
    }
  })();
}