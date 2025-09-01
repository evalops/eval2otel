import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

class CapturingTracer { lastName: string|undefined; lastOptions:any; startSpan(name:string, options:any){ this.lastName=name; this.lastOptions=options; return { addEvent() {}, setStatus() {}, recordException() {}, end() {} } as any; } }

describe('Converter misc branches', () => {
  it('includes deployment.environment on spans', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc', environment: 'prod' } as any);
    const evalResult: EvalResult = {
      id: 'u1', timestamp: Date.now(), model: 'm', system: 'custom', operation: 'chat',
      request: { model: 'm' }, response: {}, usage: {}, performance: { duration: 1 },
    } as any;
    conv.convertEvalResult(evalResult);
    expect(tracer.lastOptions.attributes['deployment.environment']).toBe('prod');
  });
});
