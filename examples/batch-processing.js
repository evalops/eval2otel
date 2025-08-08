const { createEval2Otel } = require('eval2otel');

const eval2otel = createEval2Otel({
  environment: 'testing',
  sampleContentRate: 1.0, // Sample all content in testing
  resourceAttributes: {
    'service.name': 'batch-evaluator',
    'service.version': '1.0.0'
  }
});

// Simulate batch processing of evaluations
const evaluations = [
  {
    id: 'batch-1',
    model: 'gpt-3.5-turbo',
    prompt: 'Translate "hello" to French',
    response: 'Bonjour',
    inputTokens: 8,
    outputTokens: 3,
    totalTokens: 11,
    latency: 0.5,
    cost: 0.0005,
    timestamp: new Date().toISOString(),
    metrics: { accuracy: 1.0, bleu_score: 0.98 }
  },
  {
    id: 'batch-2',
    model: 'gpt-3.5-turbo',
    prompt: 'Translate "goodbye" to French',
    response: 'Au revoir',
    inputTokens: 9,
    outputTokens: 4,
    totalTokens: 13,
    latency: 0.6,
    cost: 0.0006,
    timestamp: new Date().toISOString(),
    metrics: { accuracy: 1.0, bleu_score: 0.96 }
  },
  {
    id: 'batch-3',
    model: 'gpt-3.5-turbo',
    prompt: 'Translate "thank you" to French',
    response: 'Merci beaucoup',
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    latency: 0.7,
    cost: 0.0007,
    timestamp: new Date().toISOString(),
    metrics: { accuracy: 0.9, bleu_score: 0.92 } // "Merci" would be more accurate
  }
];

// Process batch with a parent span for the entire batch
eval2otel.withSpan({ id: 'translation-batch', model: 'batch-processor' }, (batchSpan) => {
  batchSpan.setAttributes({
    'batch.size': evaluations.length,
    'batch.type': 'translation'
  });

  console.log(`Processing batch of ${evaluations.length} evaluations...`);

  // Process each evaluation with the batch span as parent
  evaluations.forEach((evaluation, index) => {
    eval2otel.processEvaluation(evaluation, {
      parentSpan: batchSpan,
      attributes: {
        'batch.item.index': index,
        'batch.id': 'translation-batch-001'
      }
    });
  });

  console.log('Batch processing complete!');
});

// Calculate and log batch metrics
const totalLatency = evaluations.reduce((sum, eval) => sum + eval.latency, 0);
const avgAccuracy = evaluations.reduce((sum, eval) => sum + eval.metrics.accuracy, 0) / evaluations.length;
const avgBleuScore = evaluations.reduce((sum, eval) => sum + eval.metrics.bleu_score, 0) / evaluations.length;

console.log(`Batch metrics:
  Total latency: ${totalLatency.toFixed(2)}s
  Average accuracy: ${avgAccuracy.toFixed(3)}
  Average BLEU score: ${avgBleuScore.toFixed(3)}`);
