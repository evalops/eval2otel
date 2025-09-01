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
    if (this.config.useSdk === false) {
      // Honor semconv env passthrough even in no-SDK mode
      if (!process.env.OTEL_SEMCONV_STABILITY_OPT_IN && this.config.semconvStabilityOptIn) {
        process.env.OTEL_SEMCONV_STABILITY_OPT_IN = this.config.semconvStabilityOptIn;
      }
      if (!process.env.OTEL_SEMCONV_GA_VERSION && this.config.semconvGaVersion) {
        (process.env as any).OTEL_SEMCONV_GA_VERSION = this.config.semconvGaVersion;
      }
      // Still allow users to set OTLP env for their own SDK
      if (this.config.endpoint) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = this.config.endpoint;
      if (this.config.exporterProtocol) process.env.OTEL_EXPORTER_OTLP_PROTOCOL = this.config.exporterProtocol;
      if (this.config.exporterHeaders && Object.keys(this.config.exporterHeaders).length > 0) {
        process.env.OTEL_EXPORTER_OTLP_HEADERS = Object.entries(this.config.exporterHeaders)
          .map(([k, v]) => `${k}=${String(v)}`).join(',');
      }
      return; // No SDK initialization
    }
    const baseResource = Resource.default();

    // Determine final service.name respecting environment precedence
    const envServiceName = process.env.OTEL_SERVICE_NAME
      || (baseResource as any).attributes?.[SemanticResourceAttributes.SERVICE_NAME];
    const finalServiceName = (envServiceName as string) || this.config.serviceName;

    const resourceAttributes: Record<string, string> = {
      [SemanticResourceAttributes.SERVICE_NAME]: finalServiceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion ?? '1.0.0',
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
    const resource = baseResource.merge(new Resource(resourceAttributes));

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

    // Signal-specific overrides
    if (this.config.tracesEndpoint) {
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = this.config.tracesEndpoint;
    }
    if (this.config.metricsEndpoint) {
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = this.config.metricsEndpoint;
    }
    if (this.config.logsEndpoint) {
      process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = this.config.logsEndpoint;
    }
    if (this.config.tracesHeaders && Object.keys(this.config.tracesHeaders).length > 0) {
      process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS = Object.entries(this.config.tracesHeaders)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',');
    }
    if (this.config.metricsHeaders && Object.keys(this.config.metricsHeaders).length > 0) {
      process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS = Object.entries(this.config.metricsHeaders)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',');
    }
    if (this.config.logsHeaders && Object.keys(this.config.logsHeaders).length > 0) {
      process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS = Object.entries(this.config.logsHeaders)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',');
    }

    // Semantic convention stability env passthrough
    if (!process.env.OTEL_SEMCONV_STABILITY_OPT_IN && this.config.semconvStabilityOptIn) {
      process.env.OTEL_SEMCONV_STABILITY_OPT_IN = this.config.semconvStabilityOptIn;
    }
    if (!process.env.OTEL_SEMCONV_GA_VERSION && this.config.semconvGaVersion) {
      // Some SDKs look for GA version pin; set if provided
      (process.env as any).OTEL_SEMCONV_GA_VERSION = this.config.semconvGaVersion;
    }

    // Use provided SDK if supplied; otherwise create one
    if (this.config.sdk && typeof (this.config.sdk as any).start === 'function') {
      this.sdk = this.config.sdk as unknown as NodeSDK;
    } else {
      this.sdk = new NodeSDK(sdkConfig);
    }
    if (this.config.manageSdkLifecycle !== false) {
      this.sdk.start();
    }
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk && this.config.manageSdkLifecycle !== false) {
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
export { ATTR } from './attributes';
export { 
  convertOllamaToEval2Otel, 
  convertOpenAICompatibleToEval2Otel,
  convertBedrockToEval2Otel,
  convertAzureOpenAIToEval2Otel,
  convertVertexToEval2Otel,
  convertAnthropicToEval2Otel,
  convertCohereToEval2Otel,
  convertOpenAIChatToEval2Otel,
  type OllamaResponse,
  type OllamaRequest,
  type OllamaConversionOptions,
  type OpenAICompatibleResponse,
  type BedrockRequest,
  type BedrockResponse,
  type AzureOpenAIRequest,
  type AzureOpenAIResponse,
  type VertexRequest,
  type VertexResponse,
  type AnthropicRequest,
  type AnthropicResponse,
  type CohereRequest,
  type CohereResponse,
  type OpenAIChatRequest,
  type OpenAIChatResponse,
} from './providers';

// Convenience function for quick setup
export function createEval2Otel(config: OtelConfig): Eval2Otel {
  const eval2otel = new Eval2Otel(config);
  eval2otel.initialize();
  return eval2otel;
}
