const { createEval2Otel } = require('../dist/index.js');

const eval2otel = createEval2Otel({
  serviceName: 'tool-demo',
  serviceVersion: '0.1.0',
  environment: 'development',
  captureContent: true
});

// Example with tool execution
const evalWithTool = {
  id: 'eval-tool-456',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'execute_tool',
  
  request: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
  },
  
  tool: {
    name: 'get_weather',
    description: 'Get current weather for a location',
    callId: 'call_weather_123',
  },
  
  response: {
    id: 'resp-tool-789',
    model: 'gpt-4',
    finishReasons: ['tool_calls'],
    choices: [{
      index: 0,
      finishReason: 'tool_calls',
      message: {
        role: 'assistant',
        toolCalls: [{
          id: 'call_weather_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: { location: 'New York' },
          },
        }],
      },
    }],
  },
  
  usage: {
    inputTokens: 12,
    outputTokens: 15,
    totalTokens: 27,
  },
  
  performance: {
    duration: 2300, // milliseconds
  },
  
  conversation: {
    id: 'conv-tool-456',
    messages: [
      {
        role: 'user',
        content: 'What is the weather in New York?',
      },
      {
        role: 'tool',
        content: 'The current weather in New York is 72°F and sunny.',
        toolCallId: 'call_weather_123',
      },
    ],
  },
};

// Process the tool execution evaluation
eval2otel.processEvaluation(evalWithTool);

// Process with quality metrics
eval2otel.processEvaluationWithMetrics(evalWithTool, {
  accuracy: 0.9,
  relevance: 0.95,
  tool_success_rate: 1.0,
});

console.log('Tool execution evaluation processed!');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await eval2otel.shutdown();
  process.exit(0);
});
