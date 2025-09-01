import { trace, Span, SpanKind } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

class CapturingSpan implements Span {
  events: Array<{ name: string; attributes: Record<string, unknown> }> = [];
  attributes: Record<string, unknown> = {};
  // Span interface minimal stubs
  addEvent(name: string, attributesOrStartTime?: any, _startTime?: any) { const attrs = typeof attributesOrStartTime === 'object' && attributesOrStartTime !== null ? attributesOrStartTime : {}; this.events.push({ name, attributes: attrs }); return this; }
  setStatus() { return this; }
  setAttribute(key: string, value: unknown) { this.attributes[key] = value; return this; }
  setAttributes(attrs: Record<string, unknown>) { Object.assign(this.attributes, attrs); return this; }
  recordException() { return this; }
  end() {}
  // unused interface members
  spanContext(): any { return {}; }
  isRecording(): boolean { return true; }
  updateName(): this { return this; }
}

class CapturingTracer {
  public lastOptions: any = null;
  startSpan(_name: string, options: any) { this.lastOptions = options; return new CapturingSpan() as any; }
}

describe('Converter privacy and caps', () => {
  const base: EvalResult = {
    id: 'p1', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
    request: { model: 'gpt-4' }, response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'Hello world from assistant' } }] }, usage: {}, performance: { duration: 1 },
    conversation: { id: 'c1', messages: [ { role: 'user', content: 'Hello world from user' } ] },
  } as any;

  it('marks truncation and content_type, and adds fingerprint when redacted', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, contentMaxLength: 5, markTruncatedContent: true,
      redactMessageContent: (_content: string, info: { role: string }) => info.role === 'user' ? null : (info.role === 'assistant' ? null : _content),
    } as any);
    const evalResult: EvalResult = JSON.parse(JSON.stringify(base));
    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);

    const userEvt = span.events.find(e => e.name === 'gen_ai.user.message');
    const asstEvt = span.events.find(e => e.name === 'gen_ai.assistant.message');
    expect(userEvt).toBeDefined();
    expect(asstEvt).toBeDefined();
    // Redacted user content should result in fingerprint only
    expect(userEvt!.attributes!['evalops.content_sha256']).toBeDefined();
    expect(userEvt!.attributes!['gen_ai.message.content']).toBeUndefined();
    // Assistant redacted yields fingerprint too
    expect(asstEvt!.attributes!['evalops.content_sha256']).toBeDefined();
    expect(asstEvt!.attributes!['gen_ai.message.content']).toBeUndefined();
  });

  it('skips events when sampleContentRate hashes above threshold', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, sampleContentRate: 0.0000001 } as any);
    const evalResult: EvalResult = {
      id: '', // empty id yields norm ~ 1.25e-6 > 1.0e-7
      timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, usage: {}, performance: { duration: 1 }, response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'hello' } }] },
      conversation: { id: 'c', messages: [{ role: 'user', content: 'x' }] },
    } as any;
    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);
    expect(span.events.length).toBe(0);
  });

  it('caps events per span', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, maxEventsPerSpan: 1 } as any);
    const evalResult: EvalResult = {
      id: 'cap1', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'a' } }] }, usage: {}, performance: { duration: 1 },
      conversation: { id: 'c', messages: [ { role: 'user', content: 'm1' }, { role: 'user', content: 'm2' }, { role: 'user', content: 'm3' } ] },
    } as any;

    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);
    expect(span.events.length).toBeLessThanOrEqual(1);
  });

  it('executes mid-range sampling branch (0<rate<1) with non-empty id', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, sampleContentRate: 0.5 } as any);
    const evalResult: EvalResult = {
      id: 'abc', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, usage: {}, performance: { duration: 1 }, response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'hello' } }] },
    } as any;
    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);
    expect(span.events.length).toBeGreaterThanOrEqual(1);
  });

  it('truncates and types conversation text and JSON; includes toolCallId', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, contentMaxLength: 5, markTruncatedContent: true } as any);
    const evalResult: EvalResult = {
      id: 'conv', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, usage: {}, performance: { duration: 1 }, response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'ok' } }] },
      conversation: { id: 'c1', messages: [
        { role: 'user', content: '0123456789', toolCallId: 'tid1' },
        { role: 'system', content: { a: '0123456789XYZ' } as any },
      ] },
    } as any;
    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);
    const userEvt = span.events.find(e => e.name === 'gen_ai.user.message')!;
    const sysEvt = span.events.find(e => e.name === 'gen_ai.system.message')!;
    expect(userEvt!.attributes['gen_ai.message.content']).toBe('01234');
    expect(userEvt!.attributes['gen_ai.message.content_truncated']).toBe(true);
    expect(userEvt!.attributes['gen_ai.message.content_type']).toBe('text');
    expect(userEvt!.attributes['gen_ai.tool.call.id']).toBe('tid1');
    expect(sysEvt!.attributes['gen_ai.message.content_json']).toBeDefined();
    expect(sysEvt!.attributes['gen_ai.message.content_truncated']).toBe(true);
    expect(sysEvt!.attributes['gen_ai.message.content_type']).toBe('json');
  });
});
