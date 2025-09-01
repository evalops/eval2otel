import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { convertOpenAIChatToEval2Otel } from '../src/providers';

class Tracer { last:any; startSpan(_n:string,o:any){ this.last=o; return { addEvent() {}, setStatus() {}, recordException() {}, end() {} } as any; } }

describe('OpenAI native chat converter', () => {
  it('maps system_fingerprint, tool_calls, logprobs, and usage', () => {
    const start = Date.now(); const end = start + 1200;
    const req = { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], n: 1 } as any;
    const res = {
      id: 'chatcmpl-1', object: 'chat.completion', created: Math.floor(start/1000), model: 'gpt-4o',
      system_fingerprint: 'fp_123',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'ok', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'f', arguments: '{"x":1}' } }] },
        logprobs: { content: [{ token: 'ok', logprob: -0.01 }] },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 }
    } as any;

    const evalRes = convertOpenAIChatToEval2Otel(req, res, start, end);
    expect(evalRes.operation).toBe('execute_tool');
    expect(evalRes.response!.choices![0].message.toolCalls![0].function.name).toBe('f');
    expect(evalRes.usage.totalTokens).toBe(8);

    const tracer = new Tracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    conv.convertEvalResult(evalRes);
    expect(tracer.last.attributes['openai.system_fingerprint']).toBe('fp_123');
    expect(tracer.last.attributes['openai.choice0.logprobs']).toContain('logprob');
  });
});
