import { z } from 'zod';
import { 
  createEval2Otel, 
  EvalResult, 
  Eval2OtelValidation,
  CommonSchemas,
  createValidationWrapper 
} from '../src';

// Initialize eval2otel
const eval2otel = createEval2Otel({
  serviceName: 'validation-demo',
  serviceVersion: '1.0.0',
  environment: 'development',
  captureContent: true,
});

// Create validation instance
const validator = new Eval2OtelValidation({
  maxRetries: 3,
  backoffMs: 1000,
  captureErrors: true,
});

// Example 1: Validate classification output
console.log('=== Example 1: Classification Validation ===');

const classificationResult: EvalResult = {
  id: 'class-123',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'chat',
  
  request: {
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 100,
  },
  
  response: {
    id: 'resp-class-1',
    finishReasons: ['stop'],
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          label: 'positive',
          confidence: 0.92,
          reasoning: 'The text expresses satisfaction and happiness',
        }),
      },
    }],
  },
  
  usage: {
    inputTokens: 50,
    outputTokens: 30,
  },
  
  performance: {
    duration: 800,
  },
};

// Apply validation wrapper
const validateClassification = createValidationWrapper(
  CommonSchemas.Classification,
  'classification_schema'
);

const validatedResult = validateClassification(classificationResult);

if (validatedResult.validatedOutput) {
  console.log('✅ Classification validated:', validatedResult.validatedOutput);
  console.log('   Metrics:', validatedResult.validationMetrics);
} else {
  console.log('❌ Classification validation failed');
}

// Process with OpenTelemetry
eval2otel.processEvaluation(classificationResult, {
  metrics: validatedResult.validationMetrics,
});

// Example 2: Validate sentiment analysis with retry
console.log('\n=== Example 2: Sentiment Analysis with Retry ===');

async function validateSentimentWithRetry() {
  // Simulate initial invalid response
  let responseContent = {
    sentiment: 'very positive', // Invalid enum value
    score: 1.5, // Out of range
  };
  
  const result = await validator.validateWithRetry(
    CommonSchemas.Sentiment,
    responseContent,
    async (attempt, errors) => {
      console.log(`  Retry attempt ${attempt} due to errors:`, 
        errors.errors.map(e => e.message).join(', '));
      
      // Simulate fixing the response
      return {
        sentiment: 'positive',
        score: 0.85,
        aspects: [
          { aspect: 'product', sentiment: 'positive', score: 0.9 },
          { aspect: 'service', sentiment: 'neutral', score: 0.0 },
        ],
      };
    }
  );
  
  if (result.success) {
    console.log('✅ Sentiment validated after', result.attempts, 'attempts');
    console.log('   Data:', result.data);
  } else {
    console.log('❌ Sentiment validation failed after', result.attempts, 'attempts');
  }
  
  // Create eval result for this validation
  const sentimentEval: EvalResult = {
    id: 'sentiment-456',
    timestamp: Date.now(),
    model: 'gpt-4',
    system: 'openai',
    operation: 'chat',
    request: { model: 'gpt-4' },
    response: {
      choices: [{
        index: 0,
        finishReason: 'stop',
        message: {
          role: 'assistant',
          content: JSON.stringify(result.data || responseContent),
        },
      }],
    },
    usage: { inputTokens: 40, outputTokens: 50 },
    performance: { duration: 1200 + result.duration },
  };
  
  // Process with validation metrics
  eval2otel.processEvaluation(sentimentEval, {
    metrics: validator.getValidationMetrics(result),
  });
}

// Example 3: Entity extraction with complex schema
console.log('\n=== Example 3: Entity Extraction ===');

const EntityExtractionSchema = z.object({
  entities: z.array(z.object({
    text: z.string().min(1),
    type: z.enum(['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'PRODUCT']),
    confidence: z.number().min(0).max(1),
    metadata: z.object({
      startPos: z.number().optional(),
      endPos: z.number().optional(),
      disambiguationUrl: z.string().url().optional(),
    }).optional(),
  })).min(1),
  language: z.string().length(2),
  processingTime: z.number().positive(),
});

const entityResult: EvalResult = {
  id: 'entity-789',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'chat',
  
  request: {
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 500,
  },
  
  response: {
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          entities: [
            {
              text: 'Apple Inc.',
              type: 'ORGANIZATION',
              confidence: 0.98,
              metadata: {
                startPos: 0,
                endPos: 9,
                disambiguationUrl: 'https://en.wikipedia.org/wiki/Apple_Inc.',
              },
            },
            {
              text: 'Tim Cook',
              type: 'PERSON',
              confidence: 0.95,
              metadata: {
                startPos: 15,
                endPos: 23,
              },
            },
            {
              text: 'Cupertino',
              type: 'LOCATION',
              confidence: 0.92,
              metadata: {
                startPos: 30,
                endPos: 39,
              },
            },
          ],
          language: 'en',
          processingTime: 145.5,
        }),
      },
    }],
  },
  
  usage: {
    inputTokens: 100,
    outputTokens: 150,
  },
  
  performance: {
    duration: 1500,
  },
};

// Validate entity extraction
const entityValidation = validator.withSchema(EntityExtractionSchema, entityResult);

if (entityValidation.validation?.success) {
  console.log('✅ Entity extraction validated successfully');
  console.log('   Found', entityValidation.validation.data.entities.length, 'entities');
  entityValidation.validation.data.entities.forEach(entity => {
    console.log(`   - ${entity.type}: "${entity.text}" (${(entity.confidence * 100).toFixed(0)}% confidence)`);
  });
} else {
  console.log('❌ Entity validation failed:', entityValidation.validation?.errors);
}

// Process with OpenTelemetry
eval2otel.processEvaluation(entityResult, {
  metrics: entityValidation.validation ? 
    validator.getValidationMetrics(entityValidation.validation) : 
    undefined,
});

// Example 4: Q&A with source validation
console.log('\n=== Example 4: Q&A Response Validation ===');

const qaResult: EvalResult = {
  id: 'qa-101',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'chat',
  
  request: {
    model: 'gpt-4',
    temperature: 0.5,
    maxTokens: 300,
  },
  
  response: {
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          answer: 'The capital of France is Paris. It has been the capital since 987 AD.',
          confidence: 1.0,
          sources: [
            { id: 'wiki-paris', relevance: 0.95, quote: 'Paris is the capital and largest city of France' },
            { id: 'history-france', relevance: 0.88, quote: 'Paris became the capital in 987 AD' },
          ],
          followUpQuestions: [
            'What is the population of Paris?',
            'What are the main attractions in Paris?',
            'How did Paris become the capital of France?',
          ],
        }),
      },
    }],
  },
  
  usage: {
    inputTokens: 30,
    outputTokens: 120,
  },
  
  performance: {
    duration: 2000,
  },
  
  // Include RAG data if this was from retrieval
  rag: {
    retrievalMethod: 'vector_search',
    documentsRetrieved: 5,
    documentsUsed: 2,
    metrics: {
      contextPrecision: 0.90,
      answerRelevance: 0.95,
      faithfulness: 0.98,
    },
  },
};

// Validate Q&A response
const qaValidation = validator.withSchema(CommonSchemas.QAResponse, qaResult);

if (qaValidation.validation?.success) {
  console.log('✅ Q&A response validated');
  console.log('   Answer confidence:', qaValidation.validation.data.confidence);
  console.log('   Sources used:', qaValidation.validation.data.sources?.length || 0);
  console.log('   Follow-up questions:', qaValidation.validation.data.followUpQuestions?.length || 0);
} else {
  console.log('❌ Q&A validation failed');
}

// Process with validation and RAG metrics
eval2otel.processEvaluation(qaResult, {
  metrics: {
    ...validator.getValidationMetrics(qaValidation.validation!),
    'qa.source_count': qaValidation.validation?.data?.sources?.length || 0,
    'qa.followup_count': qaValidation.validation?.data?.followUpQuestions?.length || 0,
  },
});

// Run async example
validateSentimentWithRetry().then(() => {
  console.log('\n=== Validation Examples Complete ===');
  console.log('Check your OpenTelemetry backend for:');
  console.log('- Validation success/failure events');
  console.log('- Retry attempt metrics');
  console.log('- Schema compliance rates');
  console.log('- Validation duration histograms');
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await eval2otel.shutdown();
    process.exit(0);
  });
});