import { createEval2Otel, EvalResult } from '../src';

// Create the eval2otel instance
const eval2otel = createEval2Otel({
  serviceName: 'my-ai-evaluation',
  serviceVersion: '1.0.0',
  captureContent: true, // Enable capturing of message content
});

// Example evaluation result from a chat completion
const evalResult: EvalResult = {
  id: 'eval-123',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'chat',
  
  request: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1.0,
  },
  
  response: {
    id: 'resp-456',
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
    outputTokens: 12,
    totalTokens: 27,
  },
  
  performance: {
    duration: 1500, // milliseconds
    timeToFirstToken: 200,
  },
  
  conversation: {
    id: 'conv-789',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: 'Hello!',
      },
    ],
  },
};

// Process the evaluation result
eval2otel.processEvaluation(evalResult);

// Process with quality metrics
eval2otel.processEvaluationWithMetrics(evalResult, {
  accuracy: 0.95,
  relevance: 0.88,
  toxicity: 0.02,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await eval2otel.shutdown();
  process.exit(0);
});
