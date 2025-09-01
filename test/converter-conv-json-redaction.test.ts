import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

class CapturingSpan { events: any[] = []; addEvent(name:string, attributes:any){ this.events.push({ name, attributes }); } setStatus(){} recordException(){} end(){} }
class CapturingTracer { lastSpan: any; startSpan(){ this.lastSpan = new CapturingSpan(); return this.lastSpan as any; } }

describe('Conversation JSON redaction fingerprint', () => {
  it('adds evalops.content_sha256 for redacted JSON conversation content', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, redactMessageContent: () => null } as any);
    const evalResult: EvalResult = {
      id: 'cjson', timestamp: Date.now(), model: 'm', system: 'x', operation: 'chat',
      request: { model: 'm' }, response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant', content: 'ok' } }] }, usage: {}, performance: { duration: 1 },
      conversation: { id: 'cid', messages: [{ role: 'system', content: { foo: 'bar' } as any }] },
    } as any;
    conv.convertEvalResult(evalResult);
    const evt = tracer.lastSpan.events.find((e:any) => e.name === 'gen_ai.system.message');
    expect(evt.attributes['evalops.content_sha256']).toBeDefined();
    expect(evt.attributes['gen_ai.message.content_json']).toBeUndefined();
  });
});

