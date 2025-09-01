import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { convertAnthropicToEval2Otel, convertCohereToEval2Otel } from '../src/providers';

class Tracer { last:any; startSpan(_n:string,o:any){ this.last=o; return { addEvent() {}, setStatus() {}, recordException() {}, end() {} } as any; } }

describe('Anthropic and Cohere provider mappings', () => {
  it('Anthropic maps stop_reason, safety, and tool_use → execute_tool', () => {
    const start = Date.now(); const end = start + 1000;
    const req = { model: 'claude-3', messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] } as any;
    const res = { id: 'a1', model: 'claude-3', stop_reason: 'tool_use', content: [ { type: 'text', text: 'calling tool' }, { type: 'tool_use', name: 'search', input: { q: 'x' } } ], usage: { input_tokens: 1, output_tokens: 2 }, safety: { safe: true } } as any;
    const evalRes = convertAnthropicToEval2Otel(req, res, start, end);
    const tracer = new Tracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    conv.convertEvalResult(evalRes);
    expect(tracer.last.attributes['anthropic.stop_reason']).toBe('tool_use');
    expect(tracer.last.attributes['anthropic.safety']).toContain('safe');
    expect(evalRes.operation).toBe('execute_tool');
    expect(evalRes.response!.choices![0].message.toolCalls![0].function.name).toBe('search');
  });

  it('Cohere maps finish_reason and safety, usage via billed_units', () => {
    const start = Date.now(); const end = start + 250;
    const req = { model: 'command-r', messages: [{ role: 'user', content: 'hi' }] } as any;
    const res = { id: 'c1', model: 'command-r', text: 'ok', finish_reason: 'COMPLETE', meta: { billed_units: { input_tokens: 3, output_tokens: 7 } }, safety: { flagged: false } } as any;
    const evalRes = convertCohereToEval2Otel(req, res, start, end);
    const tracer = new Tracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    conv.convertEvalResult(evalRes);
    expect(tracer.last.attributes['cohere.finish_reason']).toBe('COMPLETE');
    expect(tracer.last.attributes['cohere.safety']).toContain('flagged');
    expect(evalRes.usage.totalTokens).toBe(10);
  });
});
