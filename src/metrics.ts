import { metrics, Histogram, Meter, context as otContext } from '@opentelemetry/api';
import { EvalResult, OtelConfig, ProcessOptions } from './types';

export class Eval2OtelMetrics {
  private meter: Meter;
  private config: OtelConfig;
  private customHistograms: Map<string, Histogram> = new Map();
  
  // Client metrics
  private tokenUsageHistogram!: Histogram;
  private operationDurationHistogram!: Histogram;
  
  // Server metrics (if applicable)
  private requestDurationHistogram!: Histogram;
  private timeToFirstTokenHistogram!: Histogram;
  private timePerOutputTokenHistogram!: Histogram;
  
  // RAG metrics
  private ragContextPrecisionHistogram!: Histogram;
  private ragContextRecallHistogram!: Histogram;
  private ragAnswerRelevanceHistogram!: Histogram;
  private ragFaithfulnessHistogram!: Histogram;
  private ragDocumentsRetrievedHistogram!: Histogram;
  
  // Agent metrics
  private agentStepDurationHistogram!: Histogram;
  private agentTotalStepsHistogram!: Histogram;
  
  // Validation metrics
  private validationSuccessRateHistogram!: Histogram;
  private validationRetryCountHistogram!: Histogram;
  private validationDurationHistogram!: Histogram;

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
    
    // RAG metrics
    this.ragContextPrecisionHistogram = this.meter.createHistogram('gen_ai.rag.context_precision', {
      description: 'Measures the precision of retrieved context in RAG systems',
      unit: '1',
    });
    
    this.ragContextRecallHistogram = this.meter.createHistogram('gen_ai.rag.context_recall', {
      description: 'Measures the recall of retrieved context in RAG systems',
      unit: '1',
    });
    
    this.ragAnswerRelevanceHistogram = this.meter.createHistogram('gen_ai.rag.answer_relevance', {
      description: 'Measures the relevance of generated answers in RAG systems',
      unit: '1',
    });
    
    this.ragFaithfulnessHistogram = this.meter.createHistogram('gen_ai.rag.faithfulness', {
      description: 'Measures the faithfulness of generated answers to retrieved context',
      unit: '1',
    });
    
    this.ragDocumentsRetrievedHistogram = this.meter.createHistogram('gen_ai.rag.documents_retrieved', {
      description: 'Number of documents retrieved in RAG operations',
      unit: '{document}',
    });
    
    // Agent metrics
    this.agentStepDurationHistogram = this.meter.createHistogram('gen_ai.agent.step_duration', {
      description: 'Duration of individual agent steps',
      unit: 'ms',
    });
    
    this.agentTotalStepsHistogram = this.meter.createHistogram('gen_ai.agent.total_steps', {
      description: 'Total number of steps in agent execution',
      unit: '{step}',
    });
    
    // Validation metrics
    this.validationSuccessRateHistogram = this.meter.createHistogram('gen_ai.validation.success_rate', {
      description: 'Rate of successful schema validations',
      unit: '1',
    });
    
    this.validationRetryCountHistogram = this.meter.createHistogram('gen_ai.validation.retry_count', {
      description: 'Number of retries needed for validation',
      unit: '{retry}',
    });
    
    this.validationDurationHistogram = this.meter.createHistogram('gen_ai.validation.duration', {
      description: 'Time taken for validation including retries',
      unit: 'ms',
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

    // Provider discriminator aligned with latest GenAI semconv
    const provider = this.getProviderName(evalResult.system);
    if (provider) {
      (baseAttributes as any)['gen_ai.provider.name'] = provider;
    }

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

    const ctx = this.config.enableExemplars ? otContext.active() : undefined;
    const prepare = (attrs: Record<string, string | number>) => this.filterMetricAttributes(attrs);

    // Record token usage metrics
    if (evalResult.usage.inputTokens !== undefined) {
      this.tokenUsageHistogram.record(
        evalResult.usage.inputTokens,
        prepare({ ...attributes, 'gen_ai.token.type': 'input' }),
        ctx as any,
      );
    }

    if (evalResult.usage.outputTokens !== undefined) {
      this.tokenUsageHistogram.record(
        evalResult.usage.outputTokens,
        prepare({ ...attributes, 'gen_ai.token.type': 'output' }),
        ctx as any,
      );
    }

    // Record operation duration (already in seconds from validation)
    this.operationDurationHistogram.record(
      evalResult.performance.duration,
      prepare(attributes),
      ctx as any,
    );

    // Record server-side metrics if available (already in seconds from validation)
    if (evalResult.performance.timeToFirstToken !== undefined) {
      this.timeToFirstTokenHistogram.record(
        evalResult.performance.timeToFirstToken,
        prepare(attributes),
        ctx as any,
      );
    }

    if (evalResult.performance.timePerOutputToken !== undefined) {
      this.timePerOutputTokenHistogram.record(
        evalResult.performance.timePerOutputToken,
        prepare(attributes),
        ctx as any,
      );
    }

    // Record request duration (same as operation duration for client-side)
    this.requestDurationHistogram.record(
      evalResult.performance.duration,
      prepare(attributes),
      ctx as any,
    );

    // Record RAG metrics if present
    if (evalResult.rag) {
      if (evalResult.rag.documentsRetrieved !== undefined) {
        this.ragDocumentsRetrievedHistogram.record(
          evalResult.rag.documentsRetrieved,
          prepare(attributes),
          ctx as any,
        );
      }
      if (evalResult.rag.metrics) {
        if (evalResult.rag.metrics.contextPrecision !== undefined) {
          this.ragContextPrecisionHistogram.record(
            evalResult.rag.metrics.contextPrecision,
            prepare(attributes),
            ctx as any,
          );
        }
        if (evalResult.rag.metrics.contextRecall !== undefined) {
          this.ragContextRecallHistogram.record(
            evalResult.rag.metrics.contextRecall,
            prepare(attributes),
            ctx as any,
          );
        }
        if (evalResult.rag.metrics.answerRelevance !== undefined) {
          this.ragAnswerRelevanceHistogram.record(
            evalResult.rag.metrics.answerRelevance,
            prepare(attributes),
            ctx as any,
          );
        }
        if (evalResult.rag.metrics.faithfulness !== undefined) {
          this.ragFaithfulnessHistogram.record(
            evalResult.rag.metrics.faithfulness,
            prepare(attributes),
            ctx as any,
          );
        }
      }
    }
    
    // Record agent metrics if present
    if (evalResult.agent) {
      if (evalResult.agent.steps) {
        this.agentTotalStepsHistogram.record(
          evalResult.agent.steps.length,
          prepare(attributes),
          ctx as any,
        );
        
        evalResult.agent.steps.forEach(step => {
          if (step.duration !== undefined) {
            this.agentStepDurationHistogram.record(
              step.duration,
              prepare({
                ...attributes,
                'gen_ai.agent.step.name': step.name,
                'gen_ai.agent.step.status': step.status,
              }),
              ctx as any,
            );
          }
        });
      }
    }

    // Record additional custom metrics if provided in options
    if (options?.metrics) {
      this.recordCustomMetrics(options.metrics, attributes);
    }
  }

  private getProviderName(system?: string): string | undefined {
    if (!system) return undefined;
    const s = system.toLowerCase();
    if (s.includes('azure')) return 'azure.openai';
    if (s.includes('bedrock') || s.includes('aws')) return 'aws.bedrock';
    if (s.includes('vertex') || s.includes('gemini') || s.includes('google')) return 'google.vertex';
    if (s.includes('anthropic') || s.includes('claude')) return 'anthropic';
    if (s.includes('openai')) return 'openai';
    return s;
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
      let histogram = this.customHistograms.get(name);
      if (!histogram) {
        histogram = this.createEvalHistogram(name, `Custom evaluation metric: ${name}`);
        this.customHistograms.set(name, histogram);
      }
      histogram.record(value, this.filterMetricAttributes({
        ...baseAttributes,
        'eval.metric.name': name,
        'eval.metric.type': this.getMetricType(name),
      }));
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
   * Drop high-cardinality attributes by allowlist and cap attribute count
   */
  private filterMetricAttributes(attrs: Record<string, string | number>): Record<string, string | number> {
    let result: Record<string, string | number> = attrs;
    const allow = this.config.metricAttributeAllowlist;
    if (allow && allow.length > 0) {
      const set = new Set(allow);
      const filtered: Record<string, string | number> = {};
      Object.keys(attrs).forEach(k => { if (set.has(k)) filtered[k] = attrs[k]; });
      result = filtered;
    }
    const cap = this.config.maxMetricAttributes;
    if (typeof cap === 'number' && cap > 0) {
      const entries = Object.entries(result).sort(([a], [b]) => a.localeCompare(b));
      result = Object.fromEntries(entries.slice(0, cap));
    }
    return result;
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
        histogram.record(value, this.filterMetricAttributes(baseAttributes));
      }
    });
  }
}
