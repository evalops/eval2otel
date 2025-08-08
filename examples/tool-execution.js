const { createEval2Otel } = require('eval2otel');

const eval2otel = createEval2Otel({
  environment: 'development',
  resourceAttributes: {
    'service.name': 'tool-demo',
    'service.version': '0.1.0'
  }
});

// Example with tool execution
const evalWithTool = {
  id: 'eval-tool-456',
  model: 'gpt-4-turbo',
  prompt: 'What is the weather in New York?',
  response: 'The current weather in New York is 72°F and sunny.',
  inputTokens: 12,
  outputTokens: 15,
  totalTokens: 27,
  latency: 2.3,
  cost: 0.0018,
  timestamp: new Date().toISOString(),
  tools: [
    {
      name: 'get_weather',
      inputTokens: 5,
      outputTokens: 8,
      latency: 0.8,
      cost: 0.0003
    }
  ],
  metrics: {
    accuracy: 0.9,
    relevance: 0.95,
    tool_success_rate: 1.0
  }
};

// Create a span for the entire evaluation
eval2otel.withSpan(evalWithTool, (span) => {
  // Add custom attributes to the span
  span.setAttributes({
    'user.location': 'US-East',
    'tool.count': evalWithTool.tools.length
  });

  // Process the evaluation
  eval2otel.processEvaluation(evalWithTool, {
    parentSpan: span,
    attributes: {
      'experiment.type': 'tool-usage',
      'tool.enabled': true
    }
  });

  console.log('Tool execution evaluation processed!');
});
