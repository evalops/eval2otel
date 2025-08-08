const { createEval2Otel, convertOllamaToEval2Otel } = require('eval2otel');

/**
 * Basic example: Using eval2otel with Ollama native API
 */
async function basicOllamaExample() {
  console.log('🦙 Basic Ollama Integration Example');
  
  // Initialize eval2otel
  const eval2otel = createEval2Otel({
    serviceName: 'ollama-basic-example',
    serviceVersion: '1.0.0',
    environment: 'local',
    captureContent: true,
    sampleContentRate: 1.0,
    // Configure local collector (optional)
    endpoint: 'http://localhost:4317',
    exporterProtocol: 'grpc',
  });

  try {
    // Simulate Ollama request (in real usage, you'd call Ollama API)
    const request = {
      model: 'llama3.2',
      messages: [
        { role: 'user', content: 'Explain what OpenTelemetry is in one sentence.' }
      ],
      temperature: 0.5,
      top_p: 0.9,
      num_predict: 50,
    };

    console.log('📤 Request:', JSON.stringify(request, null, 2));

    // Simulate Ollama response (replace with actual Ollama API call)
    const startTime = Date.now();
    
    // In real usage:
    // const response = await axios.post('http://localhost:11434/api/chat', request);
    // const ollamaResponse = response.data;
    
    const ollamaResponse = {
      model: 'llama3.2',
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: 'OpenTelemetry is an open-source observability framework that provides APIs, libraries, and tools to collect, process, and export telemetry data like traces, metrics, and logs from applications.',
      },
      done_reason: 'stop',
      done: true,
      total_duration: 2100000000, // 2.1 seconds in nanoseconds
      load_duration: 400000000,   // 0.4 seconds
      prompt_eval_count: 15,
      prompt_eval_duration: 300000000, // 0.3 seconds
      eval_count: 32,
      eval_duration: 1400000000, // 1.4 seconds
    };

    console.log('📥 Response:', JSON.stringify(ollamaResponse.message, null, 2));

    // Convert to eval2otel format
    const evalResult = convertOllamaToEval2Otel(request, ollamaResponse, startTime, {
      evalId: 'ollama-basic-example-001',
      conversationId: 'basic-conv-001',
      conversationMessages: [
        { role: 'user', content: request.messages[0].content },
        { role: 'assistant', content: ollamaResponse.message.content }
      ],
    });

    console.log('🔄 Converted evaluation result keys:', Object.keys(evalResult));

    // Process evaluation with quality metrics
    eval2otel.processEvaluation(evalResult, {
      metrics: {
        response_accuracy: 0.95,
        explanation_clarity: 0.90,
        conciseness: 0.85,
        technical_correctness: 0.92,
      },
      attributes: {
        'example.type': 'basic_ollama_usage',
        'model.local': 'true',
        'model.framework': 'ollama',
        'task.category': 'explanation',
        'evaluation.automated': 'false',
      },
    });

    console.log('✅ Evaluation processed successfully');

    // Allow time for telemetry export
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Shutdown
    await eval2otel.shutdown();
    console.log('🔚 eval2otel shutdown complete');

  } catch (error) {
    console.error('❌ Error in Ollama example:', error);
    throw error;
  }
}

// Usage examples for different scenarios
const examples = {
  
  /**
   * Example with conversation context
   */
  async conversationExample() {
    const eval2otel = createEval2Otel({
      serviceName: 'ollama-conversation',
      captureContent: true,
    });

    const conversation = [
      { role: 'user', content: 'What is machine learning?' },
      { role: 'assistant', content: 'Machine learning is a subset of AI...' },
      { role: 'user', content: 'Can you give me a simple example?' },
    ];

    const request = {
      model: 'mistral',
      messages: conversation,
      temperature: 0.3,
    };

    const response = {
      model: 'mistral',
      message: { role: 'assistant', content: 'Sure! A simple example is email spam detection...' },
      done: true,
      total_duration: 1800000000,
      eval_count: 25,
    };

    const evalResult = convertOllamaToEval2Otel(request, response, Date.now(), {
      conversationId: 'ml-tutorial-conv',
      conversationMessages: [...conversation, response.message],
    });

    eval2otel.processEvaluation(evalResult, {
      metrics: { followup_relevance: 0.88, example_quality: 0.85 },
      attributes: { 'conversation.turn': '2', 'topic': 'machine_learning' },
    });

    await eval2otel.shutdown();
  },

  /**
   * Example with error handling
   */
  async errorHandlingExample() {
    const eval2otel = createEval2Otel({
      serviceName: 'ollama-error-handling',
      captureContent: false, // Don't capture content for privacy
    });

    const request = { model: 'unavailable-model', messages: [{ role: 'user', content: 'test' }] };

    // Simulate error response
    const errorResult = {
      id: 'error-example-001',
      timestamp: Date.now(),
      model: 'unavailable-model',
      system: 'ollama',
      operation: 'chat',
      request: { model: request.model },
      response: { choices: [] },
      usage: { inputTokens: 5, outputTokens: 0, totalTokens: 5 },
      performance: { duration: 0.1 },
      error: {
        type: 'model_not_found',
        message: 'Model not available locally'
      },
    };

    eval2otel.processEvaluation(errorResult, {
      attributes: {
        'error.recoverable': 'true',
        'error.category': 'model_availability',
      },
    });

    await eval2otel.shutdown();
  }
};

// Export for use in other modules
module.exports = {
  basicOllamaExample,
  ...examples,
};

// Run basic example if this file is executed directly
if (require.main === module) {
  basicOllamaExample()
    .then(() => console.log('🎉 Basic Ollama example completed!'))
    .catch((error) => {
      console.error('💥 Example failed:', error);
      process.exit(1);
    });
}