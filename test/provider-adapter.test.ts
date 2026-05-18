import {
  PROVIDER_ADAPTER_MODES,
  createProviderAdapter,
  isKnownProviderAdapterMode,
} from '../src/provider-adapter';

describe('provider adapter boundary', () => {
  it('exposes known adapter modes and enriches successful conversions', () => {
    expect(PROVIDER_ADAPTER_MODES).toContain('openai-chat');
    expect(isKnownProviderAdapterMode('openai-chat')).toBe(true);
    expect(isKnownProviderAdapterMode('other')).toBe(false);

    const start = Date.now();
    const result = createProviderAdapter('openai-chat').convert({
      startTime: start,
      endTime: start + 1000,
      request: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
      },
      response: {
        object: 'chat.completion',
        id: 'chatcmpl-provider-adapter',
        model: 'gpt-4o-mini',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'hello' } }],
      },
    });

    expect(result.mode).toBe('openai-chat');
    expect(result.confidence).toBe('explicit');
    expect(result.evalResult?.provenance?.sourceFramework).toBe('provider-native');
    expect(result.evalResult?.provenance?.adapter).toBe('openai-chat');
    expect(result.evalResult?.provenance?.contractVersion).toBe('eval2otel.v1');
    expect(result.evidence.rawPayloadSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('turns adapter exceptions into structured warnings and evidence', () => {
    const result = createProviderAdapter('openai-chat').convert({
      startTime: Date.now(),
      request: { model: 'gpt-4o-mini' },
      response: undefined,
    });

    expect(result.evalResult).toBeNull();
    expect(result.warnings[0].code).toBe('provider.conversion_exception');
    expect(result.evidence.warningCount).toBe(1);
    expect(result.evidence.rawPayloadSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
