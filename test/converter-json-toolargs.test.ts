import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

class CapturingSpan {
  events: any[] = [];
  addEvent(name: string, attributes?: any) { this.events.push({ name, attributes }); return this; }
  setStatus() {}; recordException() {}; end() {};
}
class CapturingTracer {
  lastOptions: any;
  startSpan(_name: string, options: any) { this.lastOptions = options; return new CapturingSpan() as any; }
}

describe('JSON content and tool argument redaction', () => {
  it('emits content_json with truncation and tool.args with fallback when redacted', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, contentMaxLength: 10, markTruncatedContent: true,
      redactToolArguments: () => null,
    } as any);
    const evalResult: EvalResult = {
      id: 'j1', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'execute_tool',
      request: { model: 'gpt-4' }, usage: {}, performance: { duration: 1 }, response: {
        choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: { a: '0123456789XYZ' }, toolCalls: [{ id: 't1', type: 'function', function: { name: 'f', arguments: { long: 'xxxxxxxxxxxxxxxx' } } }] } }],
      },
    } as any;
    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);
    const asst = span.events.find(e => e.name === 'gen_ai.assistant.message');
    const tool = span.events.find(e => e.name === 'gen_ai.tool.message');
    expect(asst.attributes['gen_ai.message.content_json']).toBeDefined();
    expect(asst.attributes['gen_ai.message.content_truncated']).toBe(true);
    expect(asst.attributes['gen_ai.message.content_type']).toBe('json');
    // Tool args redacted -> fallback to {}
    expect(tool.attributes['gen_ai.tool.arguments']).toBe('{}');
  });

  it('fingerprints assistant JSON content when redacted to null', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true,
      redactMessageContent: () => null,
    } as any);
    const evalResult: EvalResult = {
      id: 'j2', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, usage: {}, performance: { duration: 1 }, response: {
        choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: { obj: 'x' } } }],
      },
    } as any;
    const span = new CapturingSpan();
    jest.spyOn(tracer, 'startSpan').mockReturnValue(span as any);
    conv.convertEvalResult(evalResult);
    const asst = span.events.find(e => e.name === 'gen_ai.assistant.message');
    expect(asst.attributes['evalops.content_sha256']).toBeDefined();
    expect(asst.attributes['gen_ai.message.content_json']).toBeUndefined();
  });
});
