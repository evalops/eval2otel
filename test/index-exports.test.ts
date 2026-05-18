import * as pkg from '../src';

describe('Package exports', () => {
  it('exports ATTR and core classes', () => {
    expect(pkg.ATTR).toBeDefined();
    expect(pkg.createEval2Otel).toBeDefined();
    expect(pkg.Eval2OtelConverter).toBeDefined();
    expect(pkg.Eval2OtelMetrics).toBeDefined();
  });

  it('exports contract helpers and provider adapters from the root entrypoint', () => {
    expect(pkg.EVAL2OTEL_CONTRACT_VERSION).toBe('eval2otel.v1');
    expect(pkg.UNKNOWN_SEMCONV_VERSION).toBe('unspecified');
    expect(pkg.buildConversionReport).toBeDefined();
    expect(pkg.buildEval2OtelAttributes).toBeDefined();
    expect(pkg.buildEval2OtelEvidence).toBeDefined();
    expect(pkg.normalizeProviderName('azure-openai')).toBe('azure.openai');
    expect(pkg.sha256('x')).toMatch(/^[a-f0-9]{64}$/);
    expect(pkg.detectProvider).toBeDefined();
    expect(pkg.convertProviderToEvalResult).toBeDefined();
    expect(pkg.convertProviderWithEvidence).toBeDefined();
    expect(pkg.convertAnyProvider).toBeDefined();
    expect(pkg.ATTRIBUTE_REGISTRY).toBeDefined();
    expect(pkg.assertRegisteredAttributes).toBeDefined();
    expect(pkg.collectUnknownAttributes({ 'unknown.attr': true })).toEqual(['unknown.attr']);
    expect(pkg.isRegisteredAttribute('gen_ai.provider.name')).toBe(true);
    expect(pkg.PROVIDER_ADAPTER_MODES).toContain('openai-chat');
    expect(pkg.createProviderAdapter).toBeDefined();
    expect(pkg.isKnownProviderAdapterMode('openai-chat')).toBe(true);
    expect(pkg.deriveRagMetrics).toBeDefined();
    expect(pkg.getRagMetricValue).toBeDefined();
    expect(pkg.convertPromptfooResult).toBeDefined();
    expect(pkg.convertPromptfooToEvalResults).toBeDefined();
    expect(pkg.convertOllamaToEval2Otel).toBeDefined();
    expect(pkg.convertOpenAICompatibleToEval2Otel).toBeDefined();
    expect(pkg.convertBedrockToEval2Otel).toBeDefined();
    expect(pkg.convertAzureOpenAIToEval2Otel).toBeDefined();
    expect(pkg.convertVertexToEval2Otel).toBeDefined();
    expect(pkg.convertAnthropicToEval2Otel).toBeDefined();
    expect(pkg.convertCohereToEval2Otel).toBeDefined();
    expect(pkg.convertOpenAIChatToEval2Otel).toBeDefined();
  });
});
