import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import { Eval2OtelConverter } from './converter';
import { Eval2OtelMetrics } from './metrics';
import { EvalResult, OtelConfig, ProcessOptions } from './types';

export class Eval2Otel {
  private converter: Eval2OtelConverter;
  private metrics: Eval2OtelMetrics;
  private sdk?: NodeSDK;
  private config: OtelConfig;

  constructor(config: OtelConfig) {
    // Set defaults for privacy and sampling
    this.config = {
      captureContent: false, // Default to false for privacy
      sampleContentRate: 1.0,
      ...config,
    };
    this.converter = new Eval2OtelConverter(this.config);
    this.metrics = new Eval2OtelMetrics(this.config);
  }

  /**
   * Initialize OpenTelemetry SDK with proper resource attributes
   */
  initialize(): void {
    const resourceAttributes: Record<string, string> = {
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion ?? '1.0.0',
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: 'eval2otel',
      [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: process.env.npm_package_version ?? '0.1.0',
    };

    // Add environment if configured
    if (this.config.environment) {
      resourceAttributes[SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT] = this.config.environment;
    }

    // Add custom resource attributes
    if (this.config.resourceAttributes) {
      Object.entries(this.config.resourceAttributes).forEach(([key, value]) => {
        resourceAttributes[key] = String(value);
      });
    }

    // Merge with default resource to preserve host/runtime attrs
    const resource = Resource.default().merge(new Resource(resourceAttributes));

    const sdkConfig = {
      resource,
      instrumentations: [getNodeAutoInstrumentations()],
    };

    // Add endpoint configuration if provided
    if (this.config.endpoint) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = this.config.endpoint;
    }
    if (this.config.exporterProtocol) {
      process.env.OTEL_EXPORTER_OTLP_PROTOCOL = this.config.exporterProtocol;
    }
    if (this.config.exporterHeaders && Object.keys(this.config.exporterHeaders).length > 0) {
      // Join as k=v pairs separated by commas per OTLP env format
      process.env.OTEL_EXPORTER_OTLP_HEADERS = Object.entries(this.config.exporterHeaders)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',');
    }

    this.sdk = new NodeSDK(sdkConfig);
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
   * Process a single evaluation result with optional additional context
   */
  processEvaluation(evalResult: EvalResult, options?: ProcessOptions): void {
    try {
      // Convert to OpenTelemetry spans and events
      this.converter.convertEvalResult(evalResult, options);
      
      // Record metrics
      this.metrics.recordMetrics(evalResult, options);
    } catch (error) {
      console.error('Error processing evaluation:', error);
      throw error; // Re-throw for proper error handling
    }
  }

  /**
   * Process multiple evaluation results
   */
  processEvaluations(evalResults: EvalResult[], options?: ProcessOptions): void {
    evalResults.forEach(result => this.processEvaluation(result, options));
  }

  /**
   * Helper to run a function within an evaluation span context
   */
  async withSpan<T>(evalResult: EvalResult, fn: () => Promise<T> | T, options?: ProcessOptions): Promise<T> {
    // For now, just process the evaluation and run the function
    // In a full implementation, this would create an active span context
    this.processEvaluation(evalResult, options);
    return await fn();
  }

  /**
   * Process evaluation with custom quality metrics (deprecated - use options.metrics instead)
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
export { EvalResult, OtelConfig, GenAIAttributes, ProcessOptions } from './types';
export { Eval2OtelConverter } from './converter';
export { Eval2OtelMetrics } from './metrics';
export { 
  Eval2OtelValidation, 
  ValidationResult, 
  ValidationConfig,
  CommonSchemas,
  createValidationWrapper 
} from './validation';

// Convenience function for quick setup
export function createEval2Otel(config: OtelConfig): Eval2Otel {
  const eval2otel = new Eval2Otel(config);
  eval2otel.initialize();
  return eval2otel;
}
