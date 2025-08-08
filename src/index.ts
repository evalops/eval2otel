import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import { Eval2OtelConverter } from './converter';
import { Eval2OtelMetrics } from './metrics';
import { EvalResult, OtelConfig } from './types';

export class Eval2Otel {
  private converter: Eval2OtelConverter;
  private metrics: Eval2OtelMetrics;
  private sdk?: NodeSDK;
  private config: OtelConfig;

  constructor(config: OtelConfig) {
    this.config = config;
    this.converter = new Eval2OtelConverter(config);
    this.metrics = new Eval2OtelMetrics(config);
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  initialize(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion ?? '1.0.0',
    });

    this.sdk = new NodeSDK({
      resource,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    this.sdk.start();
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
    }
  }

  /**
   * Process a single evaluation result
   */
  processEvaluation(evalResult: EvalResult): void {
    // Convert to OpenTelemetry spans and events
    this.converter.convertEvalResult(evalResult);
    
    // Record metrics
    this.metrics.recordMetrics(evalResult);
  }

  /**
   * Process multiple evaluation results
   */
  processEvaluations(evalResults: EvalResult[]): void {
    evalResults.forEach(result => this.processEvaluation(result));
  }

  /**
   * Process evaluation with custom quality metrics
   */
  processEvaluationWithMetrics(
    evalResult: EvalResult, 
    qualityMetrics: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1Score?: number;
      bleuScore?: number;
      rougeScore?: number;
      toxicity?: number;
      relevance?: number;
    }
  ): void {
    this.processEvaluation(evalResult);
    this.metrics.recordEvaluationMetrics(evalResult, qualityMetrics);
  }

  /**
   * Get the converter instance for advanced usage
   */
  getConverter(): Eval2OtelConverter {
    return this.converter;
  }

  /**
   * Get the metrics instance for advanced usage
   */
  getMetrics(): Eval2OtelMetrics {
    return this.metrics;
  }
}

// Re-export types and classes
export { EvalResult, OtelConfig, GenAIAttributes } from './types';
export { Eval2OtelConverter } from './converter';
export { Eval2OtelMetrics } from './metrics';

// Convenience function for quick setup
export function createEval2Otel(config: OtelConfig): Eval2Otel {
  const eval2otel = new Eval2Otel(config);
  eval2otel.initialize();
  return eval2otel;
}
