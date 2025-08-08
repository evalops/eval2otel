const { createEval2Otel } = require('../dist/index.js');

const eval2otel = createEval2Otel({
  serviceName: 'batch-evaluator',
  serviceVersion: '1.0.0',
  environment: 'testing',
  captureContent: true,
  sampleContentRate: 1.0, // Sample all content in testing
});

// Simulate batch processing of evaluations
const evaluations = [
  {
    id: 'batch-1',
    timestamp: Date.now(),
    model: 'gpt-3.5-turbo',
    system: 'openai',
    operation: 'chat',
    request: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 100,
    },
    response: {
      id: 'resp-batch-1',
      finishReasons: ['stop'],
      choices: [{
        index: 0,
        finishReason: 'stop',
        message: {
          role: 'assistant',
          content: 'Bonjour',
        },
      }],
    },
    usage: {
      inputTokens: 8,
      outputTokens: 3,
      totalTokens: 11,
    },
    performance: {
      duration: 500, // milliseconds
    },
    conversation: {
      id: 'conv-batch-1',
      messages: [
        { role: 'user', content: 'Translate "hello" to French' },
      ],
    },
  },
  {
    id: 'batch-2',
    timestamp: Date.now() + 1000,
    model: 'gpt-3.5-turbo',
    system: 'openai',
    operation: 'chat',
    request: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 100,
    },
    response: {
      id: 'resp-batch-2',
      finishReasons: ['stop'],
      choices: [{
        index: 0,
        finishReason: 'stop',
        message: {
          role: 'assistant',
          content: 'Au revoir',
        },
      }],
    },
    usage: {
      inputTokens: 9,
      outputTokens: 4,
      totalTokens: 13,
    },
    performance: {
      duration: 600, // milliseconds
    },
    conversation: {
      id: 'conv-batch-2',
      messages: [
        { role: 'user', content: 'Translate "goodbye" to French' },
      ],
    },
  },
  {
    id: 'batch-3',
    timestamp: Date.now() + 2000,
    model: 'gpt-3.5-turbo',
    system: 'openai',
    operation: 'chat',
    request: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 100,
    },
    response: {
      id: 'resp-batch-3',
      finishReasons: ['stop'],
      choices: [{
        index: 0,
        finishReason: 'stop',
        message: {
          role: 'assistant',
          content: 'Merci beaucoup',
        },
      }],
    },
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    },
    performance: {
      duration: 700, // milliseconds
    },
    conversation: {
      id: 'conv-batch-3',
      messages: [
        { role: 'user', content: 'Translate "thank you" to French' },
      ],
    },
  }
];

console.log(`Processing batch of ${evaluations.length} evaluations...`);

// Process batch evaluations
eval2otel.processEvaluations(evaluations);

// Process each with quality metrics
evaluations.forEach((evaluation, index) => {
  const metrics = [
    { accuracy: 1.0, bleu_score: 0.98 },
    { accuracy: 1.0, bleu_score: 0.96 },
    { accuracy: 0.9, bleu_score: 0.92 } // "Merci" would be more accurate
  ];
  
  eval2otel.processEvaluationWithMetrics(evaluation, metrics[index]);
});

console.log('Batch processing complete!');

// Calculate and log batch metrics
const totalDuration = evaluations.reduce((sum, eval) => sum + eval.performance.duration, 0);
const metrics = [
  { accuracy: 1.0, bleu_score: 0.98 },
  { accuracy: 1.0, bleu_score: 0.96 },
  { accuracy: 0.9, bleu_score: 0.92 }
];
const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracy, 0) / metrics.length;
const avgBleuScore = metrics.reduce((sum, m) => sum + m.bleu_score, 0) / metrics.length;

console.log(`Batch metrics:
  Total duration: ${(totalDuration / 1000).toFixed(2)}s
  Average accuracy: ${avgAccuracy.toFixed(3)}
  Average BLEU score: ${avgBleuScore.toFixed(3)}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await eval2otel.shutdown();
  process.exit(0);
});
