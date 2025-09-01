import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

class CapturingSpan { addEvent() {}; setStatus() {}; recordException() {}; end() {}; spanContext() { return { traceId: 't', spanId: 's' }; } }
class CapturingTracer {
  public lastOptions: any;
  startSpan(_name: string, options: any) { this.lastOptions = options; return new CapturingSpan() as any; }
}

describe('Links and provider attribute', () => {
  it('adds links and provider name to span attributes', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: false } as any);
    const evalResult: EvalResult = {
      id: 'l1', timestamp: Date.now(), model: 'gpt-4', system: 'azure openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: {}, usage: {}, performance: { duration: 1 },
    } as any;
    const linkCtx = { traceId: 'abcd', spanId: '1234', traceFlags: 1 } as any;
    conv.convertEvalResult(evalResult, { links: [linkCtx] });
    expect(tracer.lastOptions.links?.length).toBe(1);
    expect(tracer.lastOptions.attributes['gen_ai.provider.name']).toBe('azure.openai');
  });

  it('accepts Span links and {context} links', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    const fakeSpan = { spanContext: () => ({ traceId: 't2', spanId: 's2', traceFlags: 1 }) } as any;
    const evalResult: EvalResult = {
      id: 'l2', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: {}, usage: {}, performance: { duration: 1 },
    } as any;
    conv.convertEvalResult(evalResult, { links: [fakeSpan, null as any, { foo: 'bar' } as any, { context: { traceId: 't3', spanId: 's3', traceFlags: 1 } }] });
    // null gets filtered out and does not break links mapping
    expect(tracer.lastOptions.links?.length).toBe(2);
  });
});
