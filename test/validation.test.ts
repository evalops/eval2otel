import { z } from 'zod';
import { 
  Eval2OtelValidation, 
  CommonSchemas, 
  createValidationWrapper,
  EvalResult 
} from '../src';

describe('Structured Output Validation', () => {
  const validator = new Eval2OtelValidation({
    maxRetries: 2,
    backoffMs: 100,
    captureErrors: true,
  });

  describe('Schema Validation', () => {
    it('should validate successful classification output', () => {
      const evalResult: EvalResult = {
        id: 'test-1',
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
              content: JSON.stringify({
                label: 'positive',
                confidence: 0.85,
                reasoning: 'Clear positive indicators',
              }),
            },
          }],
        },
        usage: { inputTokens: 10, outputTokens: 20 },
        performance: { duration: 500 },
      };

      const result = validator.withSchema(CommonSchemas.Classification, evalResult);
      
      expect(result.validation).toBeDefined();
      expect(result.validation?.success).toBe(true);
      expect(result.validation?.data).toEqual({
        label: 'positive',
        confidence: 0.85,
        reasoning: 'Clear positive indicators',
      });
    });

    it('should fail validation for invalid schema', () => {
      const evalResult: EvalResult = {
        id: 'test-2',
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
              content: JSON.stringify({
                label: 'positive',
                confidence: 1.5, // Out of range
              }),
            },
          }],
        },
        usage: { inputTokens: 10, outputTokens: 20 },
        performance: { duration: 500 },
      };

      const result = validator.withSchema(CommonSchemas.Classification, evalResult);
      
      expect(result.validation?.success).toBe(false);
      expect(result.validation?.errors).toBeDefined();
    });

    it('should handle non-JSON string content', () => {
      const evalResult: EvalResult = {
        id: 'test-3',
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
              content: 'This is plain text, not JSON',
            },
          }],
        },
        usage: { inputTokens: 10, outputTokens: 20 },
        performance: { duration: 500 },
      };

      const result = validator.withSchema(CommonSchemas.Classification, evalResult);
      
      expect(result.validation?.success).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should retry validation with corrected data', async () => {
      let attempts = 0;
      
      const result = await validator.validateWithRetry(
        CommonSchemas.Sentiment,
        { sentiment: 'invalid', score: 2.0 }, // Invalid data
        async (attempt, errors) => {
          attempts = attempt;
          // Return valid data on retry
          return {
            sentiment: 'positive',
            score: 0.75,
          };
        }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2); // First attempt failed, second succeeded
      expect(result.data).toEqual({
        sentiment: 'positive',
        score: 0.75,
      });
    });

    it('should fail after max retries', async () => {
      const result = await validator.validateWithRetry(
        CommonSchemas.Sentiment,
        { sentiment: 'invalid' },
        async () => {
          // Keep returning invalid data
          return { sentiment: 'still invalid' };
        }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2); // With maxRetries=2, we get initial + 1 retry = 2 attempts
      expect(result.errors).toBeDefined();
    });
  });

  describe('Common Schemas', () => {
    it('should validate sentiment analysis', () => {
      const validSentiment = {
        sentiment: 'positive' as const,
        score: 0.8,
        aspects: [
          { aspect: 'quality', sentiment: 'positive' as const, score: 0.9 },
          { aspect: 'price', sentiment: 'negative' as const, score: -0.3 },
        ],
      };

      const result = CommonSchemas.Sentiment.safeParse(validSentiment);
      expect(result.success).toBe(true);
    });

    it('should validate entity extraction', () => {
      const validEntities = {
        entities: [
          {
            text: 'John Doe',
            type: 'PERSON',
            confidence: 0.95,
            metadata: { startPos: 0 },
          },
        ],
      };

      const result = CommonSchemas.Entities.safeParse(validEntities);
      expect(result.success).toBe(true);
    });

    it('should validate Q&A response', () => {
      const validQA = {
        answer: 'The answer is 42',
        confidence: 0.99,
        sources: [
          { id: 'doc1', relevance: 0.9, quote: 'relevant quote' },
        ],
        followUpQuestions: ['Why 42?'],
      };

      const result = CommonSchemas.QAResponse.safeParse(validQA);
      expect(result.success).toBe(true);
    });

    it('should validate summary', () => {
      const validSummary = {
        title: 'Test Summary',
        summary: 'This is a comprehensive test summary with sufficient length',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
        sentiment: 'neutral' as const,
        categories: ['test', 'validation'],
      };

      const result = CommonSchemas.Summary.safeParse(validSummary);
      expect(result.success).toBe(true);
    });

    it('should validate tool call decision', () => {
      const validToolCall = {
        shouldCall: true,
        toolName: 'calculator',
        arguments: { operation: 'add', a: 1, b: 2 },
        reasoning: 'User wants to add numbers',
      };

      const result = CommonSchemas.ToolCall.safeParse(validToolCall);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Wrapper', () => {
    it('should create a validation wrapper function', () => {
      const wrapper = createValidationWrapper(
        CommonSchemas.Classification,
        'test_schema'
      );

      const evalResult: EvalResult = {
        id: 'wrapper-test',
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
              content: JSON.stringify({
                label: 'neutral',
                confidence: 0.6,
              }),
            },
          }],
        },
        usage: { inputTokens: 10, outputTokens: 20 },
        performance: { duration: 500 },
      };

      const result = wrapper(evalResult);
      
      expect(result.validatedOutput).toBeDefined();
      expect(result.validatedOutput?.label).toBe('neutral');
      expect(result.validationMetrics).toBeDefined();
      expect(result.validationMetrics?.['validation.success']).toBe(1);
    });
  });

  describe('Validation Metrics', () => {
    it('should generate correct metrics for successful validation', () => {
      const successResult = {
        success: true,
        data: { test: 'data' },
        attempts: 1,
        duration: 150,
      };

      const metrics = validator.getValidationMetrics(successResult);
      
      expect(metrics['validation.success']).toBe(1);
      expect(metrics['validation.attempts']).toBe(1);
      expect(metrics['validation.duration_ms']).toBe(150);
      expect(metrics['validation.error_count']).toBe(0);
    });

    it('should generate correct metrics for failed validation', () => {
      const errorResult = {
        success: false,
        errors: new z.ZodError([
          {
            code: 'invalid_type' as const,
            expected: 'string',
            received: 'number',
            path: ['field1'],
            message: 'Expected string',
          },
          {
            code: 'too_small' as const,
            minimum: 0,
            type: 'number',
            inclusive: true,
            exact: false,
            path: ['field2'],
            message: 'Too small',
          },
        ] as any),
        attempts: 3,
        duration: 500,
      };

      const metrics = validator.getValidationMetrics(errorResult);
      
      expect(metrics['validation.success']).toBe(0);
      expect(metrics['validation.attempts']).toBe(3);
      expect(metrics['validation.duration_ms']).toBe(500);
      expect(metrics['validation.error_count']).toBe(2);
    });
  });

  describe('Custom Schema', () => {
    it('should work with custom user-defined schemas', () => {
      const CustomProductSchema = z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100),
        price: z.number().positive(),
        inStock: z.boolean(),
        categories: z.array(z.string()).min(1),
        metadata: z.record(z.string(), z.unknown()).optional(),
      });

      const evalResult: EvalResult = {
        id: 'custom-test',
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
              content: JSON.stringify({
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Product',
                price: 29.99,
                inStock: true,
                categories: ['electronics', 'gadgets'],
                metadata: { color: 'blue', weight: '100g' },
              }),
            },
          }],
        },
        usage: { inputTokens: 10, outputTokens: 20 },
        performance: { duration: 500 },
      };

      const result = validator.withSchema(CustomProductSchema, evalResult);
      
      expect(result.validation?.success).toBe(true);
      expect(result.validation?.data?.name).toBe('Test Product');
      expect(result.validation?.data?.price).toBe(29.99);
    });
  });
});