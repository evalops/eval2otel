import {
  detectProvider,
  convertProviderToEvalResult,
  convertProviderWithEvidence,
  convertAnyProvider,
  isProviderKnown,
  listSupportedProviders,
} from '../src/helpers';

describe('helpers: detectProvider / convertProviderToEvalResult', () => {
  it('detects openai-chat and converts to EvalResult', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] };
    const response = { id: 'id', object: 'chat.completion', created: Math.floor(start/1000), model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('openai-chat');
    const evalRes = convertProviderToEvalResult(request, response, start, end, mode);
    expect(evalRes?.response?.finishReasons).toEqual(['stop']);
  });

  it('returns unknown when cannot detect', () => {
    const mode = detectProvider({}, {});
    expect(mode).toBe('unknown');
    const evalRes = convertProviderToEvalResult({}, {}, Date.now(), Date.now()+1, mode);
    expect(evalRes).toBeNull();
  });


  it('detects openai-compatible and converts (fn cov)', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { model: 'gpt-4o' } as any;
    const response = { id: 'id', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content: 'ok', tool_calls: [{ id: 't', type: 'function', function: { name: 'f', arguments: '{"x":1}' } }] }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('openai-compatible');
    const res = convertProviderToEvalResult(request, response, start, end, mode);
    expect(res?.operation).toBe('execute_tool');
  });

  it('detects bedrock and converts (fn cov)', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { modelId: 'cohere.command' } as any;
    const response = { modelId: 'cohere.command', outputText: 'ok' } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('bedrock');
    const res = convertProviderToEvalResult(request, response, start, end, mode);
    expect(res?.system).toBe('aws.bedrock');
  });

  it('detects vertex and converts (fn cov)', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { model: 'gemini-1.5' } as any;
    const response = { model: 'gemini-1.5', candidates: [{ content: { role: 'assistant', parts: [{ text: 'ok' }] } }] } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('vertex');
    const res = convertProviderToEvalResult(request, response, start, end, mode);
    expect(res?.system).toBe('google.vertex');
  });

  it('detects anthropic and converts (fn cov)', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { model: 'claude-3' } as any;
    const response = { id: 'a', model: 'claude-3', content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 't', input: { x: 1 } }] } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('anthropic');
    const res = convertProviderToEvalResult(request, response, start, end, mode);
    expect(res?.system).toBe('anthropic');
  });

  it('detects cohere and converts (fn cov)', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { model: 'command-r' } as any;
    const response = { id: 'c', model: 'command-r', text: 'ok', meta: { billed_units: { input_tokens: 1, output_tokens: 2 } } } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('cohere');
    const res = convertProviderToEvalResult(request, response, start, end, mode);
    expect(res?.system).toBe('cohere');
  });

  it('detects ollama and converts (fn cov)', () => {
    const start = Date.now(); const end = start + 1000;
    const request = { model: 'llama3' } as any;
    const response = { model: 'llama3', created_at: new Date(start).toISOString(), message: { role: 'assistant', content: 'ok' }, done: true, eval_duration: 1 } as any;
    const mode = detectProvider(request, response);
    expect(mode).toBe('ollama');
    const res = convertProviderToEvalResult(request, response, start, end, mode);
    expect(res?.system).toBe('ollama');
  });

  it('convertAnyProvider convenience works for openai-chat', () => {
    const start = Date.now(); const end = start + 1000;
    const payload = {
      startTime: start,
      endTime: end,
      request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      response: { id: 'id', object: 'chat.completion', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }]},
    } as any;
    const res = convertAnyProvider(payload);
    expect(res?.system).toBe('openai');
  });


  it('isProviderKnown and listSupportedProviders expose supported modes', () => {
    expect(isProviderKnown('openai-chat')).toBe(true);
    expect(isProviderKnown('unknown')).toBe(false);
    const list = listSupportedProviders();
    expect(list).toContain('vertex');
  });

  it('convertProviderWithEvidence enriches adapter provenance and raw payload hash', () => {
    const start = Date.now();
    const request = { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] };
    const response = {
      object: 'chat.completion',
      id: 'chatcmpl-1',
      model: 'gpt-4o-mini',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'hello' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };

    const result = convertProviderWithEvidence({
      request,
      response,
      startTime: start,
      endTime: start + 1000,
      provider: 'openai-chat',
    });

    expect(result.confidence).toBe('explicit');
    expect(result.evalResult?.provenance?.adapter).toBe('openai-chat');
    expect(result.evalResult?.provenance?.contractVersion).toBe('eval2otel.v1');
    expect(result.evalResult?.evidence?.rawPayloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.warnings).toEqual([]);
  });

  it('convertProviderWithEvidence reports unsupported provider modes', () => {
    const result = convertProviderWithEvidence({
      request: {},
      response: {},
      startTime: Date.now(),
      provider: 'mystery-provider',
    });

    expect(result.evalResult).toBeNull();
    expect(result.confidence).toBe('unknown');
    expect(result.warnings[0].code).toBe('provider.unsupported');
    expect(result.evidence.warningCount).toBe(1);
  });

});
