import { createEval2Otel, EvalResult } from '../src';

const eval2otel = createEval2Otel({
  serviceName: 'ai-tool-evaluator',
  serviceVersion: '1.0.0',
  captureContent: true,
});

// Example of evaluating tool execution
const toolEvalResult: EvalResult = {
  id: 'tool-eval-456',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'execute_tool',
  
  request: {
    model: 'gpt-4',
    temperature: 0.1,
  },
  
  response: {
    id: 'tool-resp-789',
    model: 'gpt-4',
    choices: [{
      index: 0,
      finishReason: 'tool_calls',
      message: {
        role: 'assistant',
        toolCalls: [{
          id: 'call_abc123',
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
    inputTokens: 125,
    outputTokens: 45,
  },
  
  performance: {
    duration: 2300,
    timeToFirstToken: 350,
    timePerOutputToken: 50,
  },
  
  tool: {
    name: 'get_weather',
    description: 'Get current weather for a location',
    callId: 'call_abc123',
    result: {
      location: 'San Francisco',
      temperature: 18,
      unit: 'celsius',
      conditions: 'partly cloudy',
    },
  },
  
  conversation: {
    id: 'conv-weather-123',
    messages: [
      {
        role: 'user',
        content: 'What is the weather like in San Francisco?',
      },
      {
        role: 'assistant',
        toolCalls: [{
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: { location: 'San Francisco', unit: 'celsius' },
          },
        }],
      },
      {
        role: 'tool',
        content: {
          location: 'San Francisco',
          temperature: 18,
          unit: 'celsius',
          conditions: 'partly cloudy',
        },
        toolCallId: 'call_abc123',
      },
    ],
  },
};

// Process the tool evaluation
eval2otel.processEvaluationWithMetrics(toolEvalResult, {
  accuracy: 0.92,
  relevance: 0.98,
  f1Score: 0.89,
});

console.log('Tool evaluation processed and sent to OpenTelemetry');
