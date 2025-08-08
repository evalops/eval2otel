import { z } from 'zod';
import { Span } from '@opentelemetry/api';
import { EvalResult } from './types';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
  attempts: number;
  duration: number;
}

export interface ValidationConfig {
  maxRetries?: number;
  backoffMs?: number;
  captureErrors?: boolean;
}

export class Eval2OtelValidation {
  private config: ValidationConfig;
  
  constructor(config: ValidationConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      backoffMs: config.backoffMs ?? 1000,
      captureErrors: config.captureErrors ?? true,
    };
  }

  /**
   * Validate LLM output against a Zod schema with retry logic
   */
  async validateWithRetry<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    retryFn?: (attempt: number, errors: z.ZodError) => Promise<unknown>
  ): Promise<ValidationResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: z.ZodError | undefined;
    
    while (attempts < this.config.maxRetries!) {
      attempts++;
      
      try {
        const validated = schema.parse(data);
        return {
          success: true,
          data: validated,
          attempts,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          lastError = error;
          
          // If we have a retry function and haven't exceeded retries
          if (retryFn && attempts < this.config.maxRetries!) {
            // Wait with backoff
            await new Promise(resolve => 
              setTimeout(resolve, this.config.backoffMs! * attempts)
            );
            
            // Get new data from retry function
            data = await retryFn(attempts, error);
          } else {
            break;
          }
        } else {
          throw error;
        }
      }
    }
    
    return {
      success: false,
      errors: lastError,
      attempts,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Create a validation wrapper for EvalResult
   */
  withSchema<T>(
    schema: z.ZodSchema<T>,
    evalResult: EvalResult
  ): EvalResult & { validation?: ValidationResult<T> } {
    const content = evalResult.response.choices?.[0]?.message?.content;
    
    if (!content) {
      return evalResult;
    }
    
    let parsedContent: unknown;
    
    // Try to parse JSON if content is a string
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        parsedContent = content;
      }
    } else {
      parsedContent = content;
    }
    
    // Synchronous validation (no retry)
    try {
      const validated = schema.parse(parsedContent);
      return {
        ...evalResult,
        validation: {
          success: true,
          data: validated,
          attempts: 1,
          duration: 0,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          ...evalResult,
          validation: {
            success: false,
            errors: error,
            attempts: 1,
            duration: 0,
          },
        };
      }
      throw error;
    }
  }

  /**
   * Add validation events to a span
   */
  addValidationEvents<T>(
    span: Span,
    schemaName: string,
    result: ValidationResult<T>
  ): void {
    if (result.success) {
      span.addEvent('gen_ai.validation.success', {
        'validation.schema': schemaName,
        'validation.attempts': result.attempts,
        'validation.duration': result.duration,
      });
    } else {
      const errorSummary = this.summarizeErrors(result.errors!);
      
      span.addEvent('gen_ai.validation.failed', {
        'validation.schema': schemaName,
        'validation.attempts': result.attempts,
        'validation.duration': result.duration,
        'validation.error_count': errorSummary.totalErrors,
        'validation.error_types': errorSummary.errorTypes.join(', '),
      });
      
      if (this.config.captureErrors) {
        span.addEvent('gen_ai.validation.errors', {
          'validation.errors': JSON.stringify(result.errors?.issues),
        });
      }
    }
  }

  /**
   * Get validation metrics for tracking
   */
  getValidationMetrics<T>(result: ValidationResult<T>): Record<string, number> {
    return {
      'validation.success': result.success ? 1 : 0,
      'validation.attempts': result.attempts,
      'validation.duration_ms': result.duration,
      'validation.error_count': result.errors?.issues.length ?? 0,
    };
  }

  /**
   * Summarize validation errors for metrics
   */
  private summarizeErrors(errors: z.ZodError): {
    totalErrors: number;
    errorTypes: string[];
    fieldErrors: Record<string, number>;
  } {
    const errorTypes = new Set<string>();
    const fieldErrors: Record<string, number> = {};
    
    errors.issues.forEach((error: z.ZodIssue) => {
      errorTypes.add(error.code);
      
      const field = error.path.join('.');
      if (field) {
        fieldErrors[field] = (fieldErrors[field] || 0) + 1;
      }
    });
    
    return {
      totalErrors: errors.issues.length,
      errorTypes: Array.from(errorTypes),
      fieldErrors,
    };
  }
}

/**
 * Common schemas for LLM outputs
 */
export const CommonSchemas = {
  // Classification response
  Classification: z.object({
    label: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  }),
  
  // Sentiment analysis
  Sentiment: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    score: z.number().min(-1).max(1),
    aspects: z.array(z.object({
      aspect: z.string(),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      score: z.number().min(-1).max(1),
    })).optional(),
  }),
  
  // Entity extraction
  Entities: z.object({
    entities: z.array(z.object({
      text: z.string(),
      type: z.string(),
      confidence: z.number().min(0).max(1),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })),
  }),
  
  // Structured summary
  Summary: z.object({
    title: z.string().min(1).max(200),
    summary: z.string().min(10),
    keyPoints: z.array(z.string()).min(1),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    categories: z.array(z.string()).optional(),
  }),
  
  // Q&A response
  QAResponse: z.object({
    answer: z.string(),
    confidence: z.number().min(0).max(1),
    sources: z.array(z.object({
      id: z.string(),
      relevance: z.number().min(0).max(1),
      quote: z.string().optional(),
    })).optional(),
    followUpQuestions: z.array(z.string()).optional(),
  }),
  
  // Tool call decision
  ToolCall: z.object({
    shouldCall: z.boolean(),
    toolName: z.string().optional(),
    arguments: z.record(z.string(), z.unknown()).optional(),
    reasoning: z.string().optional(),
  }),
};

/**
 * Create a validation-enabled eval processor
 */
export function createValidationWrapper<T>(
  schema: z.ZodSchema<T>,
  schemaName: string
) {
  return (evalResult: EvalResult): EvalResult & { 
    validatedOutput?: T;
    validationMetrics?: Record<string, number>;
    validationSchema?: string;
  } => {
    const validation = new Eval2OtelValidation();
    const result = validation.withSchema(schema, evalResult);
    
    if (result.validation?.success) {
      return {
        ...evalResult,
        validatedOutput: result.validation.data,
        validationMetrics: validation.getValidationMetrics(result.validation),
        validationSchema: schemaName,
      };
    }
    
    return {
      ...evalResult,
      validationMetrics: validation.getValidationMetrics(result.validation!),
      validationSchema: schemaName,
    };
  };
}
