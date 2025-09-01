import { detectProvider, convertProviderToEvalResult } from '../src/helpers';

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
});
