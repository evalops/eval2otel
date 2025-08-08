import { metrics, Histogram, Meter } from '@opentelemetry/api';
import { EvalResult, OtelConfig } from './types';

export class Eval2OtelMetrics {
  private meter: Meter;
  private config: OtelConfig;
  
  // Client metrics
  private tokenUsageHistogram!: Histogram;
  private operationDurationHistogram!: Histogram;
  
  // Server metrics (if applicable)
  private requestDurationHistogram!: Histogram;
  private timeToFirstTokenHistogram!: Histogram;
  private timePerOutputTokenHistogram!: Histogram;

  constructor(config: OtelConfig) {
    this.config = config;
    this.meter = metrics.getMeter('eval2otel', config.serviceVersion);
    
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Client metrics
    this.tokenUsageHistogram = this.meter.createHistogram('gen_ai.client.token.usage', {
      description: 'Measures the number of input and output tokens used',
      unit: '{token}',
    });

    this.operationDurationHistogram = this.meter.createHistogram('gen_ai.client.operation.duration', {
      description: 'Measures the duration of GenAI client operations',
      unit: 's',
    });

    // Server metrics
    this.requestDurationHistogram = this.meter.createHistogram('gen_ai.server.request.duration', {
      description: 'Measures the Generative AI server request duration',
      unit: 's',
    });

    this.timeToFirstTokenHistogram = this.meter.createHistogram('gen_ai.server.time_to_first_token', {
      description: 'Measures the time to generate the first token for successful responses',
      unit: 's',
    });

    this.timePerOutputTokenHistogram = this.meter.createHistogram('gen_ai.server.time_per_output_token', {
      description: 'Measures the time per output token generated after the first token',
      unit: 's',
    });
  }

  /**
   * Record metrics from an evaluation result
   */
  recordMetrics(evalResult: EvalResult): void {
    const baseAttributes = {
      'gen_ai.operation.name': evalResult.operation,
      'gen_ai.system': evalResult.system ?? 'unknown',
      'gen_ai.request.model': evalResult.request.model,
      'gen_ai.response.model': evalResult.response.model ?? evalResult.request.model,
    };

    // Add error type if present
    const attributes: Record<string, string | number> = { ...baseAttributes };
    if (evalResult.error) {
      attributes['error.type'] = evalResult.error.type;
    }

    // Record token usage metrics
    if (evalResult.usage.inputTokens !== undefined) {
      this.tokenUsageHistogram.record(evalResult.usage.inputTokens, {
        ...attributes,
        'gen_ai.token.type': 'input',
      });
    }

    if (evalResult.usage.outputTokens !== undefined) {
      this.tokenUsageHistogram.record(evalResult.usage.outputTokens, {
        ...attributes,
        'gen_ai.token.type': 'output',
      });
    }

    // Record operation duration (convert from milliseconds to seconds)
    this.operationDurationHistogram.record(evalResult.performance.duration / 1000, attributes);

    // Record server-side metrics if available
    if (evalResult.performance.timeToFirstToken !== undefined) {
      this.timeToFirstTokenHistogram.record(evalResult.performance.timeToFirstToken / 1000, attributes);
    }

    if (evalResult.performance.timePerOutputToken !== undefined && evalResult.usage.outputTokens) {
      // Calculate average time per output token
      const avgTimePerToken = evalResult.performance.timePerOutputToken / 1000;
      this.timePerOutputTokenHistogram.record(avgTimePerToken, attributes);
    }

    // Record request duration (same as operation duration for client-side)
    this.requestDurationHistogram.record(evalResult.performance.duration / 1000, attributes);
  }

  /**
   * Create a custom counter for evaluation-specific metrics
   */
  createEvalCounter(name: string, description: string, unit = '{count}') {
    return this.meter.createCounter(`eval.${name}`, {
      description,
      unit,
    });
  }

  /**
   * Create a custom histogram for evaluation-specific metrics
   */
  createEvalHistogram(name: string, description: string, unit = '{value}') {
    return this.meter.createHistogram(`eval.${name}`, {
      description,
      unit,
    });
  }

  /**
   * Record evaluation accuracy metrics
   */
  recordEvaluationMetrics(evalResult: EvalResult, metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    bleuScore?: number;
    rougeScore?: number;
    toxicity?: number;
    relevance?: number;
  }): void {
    const baseAttributes = {
      'gen_ai.operation.name': evalResult.operation,
      'gen_ai.system': evalResult.system ?? 'unknown',
      'gen_ai.request.model': evalResult.request.model,
    };

    // Record each metric if present
    Object.entries(metrics).forEach(([metricName, value]) => {
      if (value !== undefined) {
        const histogram = this.createEvalHistogram(metricName, `Evaluation ${metricName} score`);
        histogram.record(value, baseAttributes);
      }
    });
  }
}
