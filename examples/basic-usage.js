const { createEval2Otel } = require('eval2otel');

// Initialize eval2otel with configuration
const eval2otel = createEval2Otel({
  environment: 'production',
  sampleContentRate: 0.1, // Sample 10% of content for privacy
  redact: (content) => content.replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED]'),
  resourceAttributes: {
    'service.name': 'my-ai-app',
    'service.version': '1.0.0'
  }
});

// Example evaluation result
const evalResult = {
  id: 'eval-123',
  model: 'gpt-4',
  prompt: 'What is the capital of France?',
  response: 'The capital of France is Paris.',
  inputTokens: 10,
  outputTokens: 8,
  totalTokens: 18,
  latency: 1.2, // seconds
  cost: 0.0012,
  timestamp: new Date().toISOString(),
  metrics: {
    accuracy: 1.0,
    bleu_score: 0.95
  }
};

// Process the evaluation and send to OpenTelemetry
eval2otel.processEvaluation(evalResult, {
  attributes: {
    'user.id': 'user-456',
    'experiment.name': 'capital-cities-test'
  }
});

console.log('Evaluation processed and sent to OpenTelemetry!');
