import { metrics, Histogram, Meter } from '@opentelemetry/api';
import { EvalResult, OtelConfig, ProcessOptions } from './types';

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
  recordMetrics(evalResult: EvalResult, options?: ProcessOptions): void {
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

    // Add environment if configured
    if (this.config.environment) {
      attributes['deployment.environment'] = this.config.environment;
    }

    // Add additional attributes from options
    if (options?.attributes) {
      Object.assign(attributes, options.attributes);
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

    // Record operation duration (already in seconds from validation)
    this.operationDurationHistogram.record(evalResult.performance.duration, attributes);

    // Record server-side metrics if available (already in seconds from validation)
    if (evalResult.performance.timeToFirstToken !== undefined) {
      this.timeToFirstTokenHistogram.record(evalResult.performance.timeToFirstToken, attributes);
    }

    if (evalResult.performance.timePerOutputToken !== undefined) {
      this.timePerOutputTokenHistogram.record(evalResult.performance.timePerOutputToken, attributes);
    }

    // Record request duration (same as operation duration for client-side)
    this.requestDurationHistogram.record(evalResult.performance.duration, attributes);

    // Record additional custom metrics if provided in options
    if (options?.metrics) {
      this.recordCustomMetrics(options.metrics, attributes);
    }
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
   * Record custom metrics with proper naming
   */
  private recordCustomMetrics(
    metrics: Record<string, number>, 
    baseAttributes: Record<string, string | number>
  ): void {
    Object.entries(metrics).forEach(([name, value]) => {
      const histogram = this.createEvalHistogram(name, `Custom evaluation metric: ${name}`);
      histogram.record(value, {
        ...baseAttributes,
        'eval.metric.name': name,
        'eval.metric.type': this.getMetricType(name),
      });
    });
  }

  /**
   * Determine metric type from name for better categorization
   */
  private getMetricType(metricName: string): string {
    const name = metricName.toLowerCase();
    
    if (name.includes('accuracy') || name.includes('precision') || name.includes('recall') || name.includes('f1')) {
      return 'quality';
    }
    if (name.includes('bleu') || name.includes('rouge') || name.includes('meteor')) {
      return 'similarity';
    }
    if (name.includes('toxicity') || name.includes('bias') || name.includes('safety')) {
      return 'safety';
    }
    if (name.includes('latency') || name.includes('duration') || name.includes('time')) {
      return 'performance';
    }
    
    return 'custom';
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
