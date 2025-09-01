import { Eval2Otel, createEval2Otel } from '../src/index';
import { EvalResult } from '../src/types';

describe('Index functions coverage', () => {
  const mkEval = (id: string): EvalResult => ({
    id, timestamp: Date.now(), model: 'm', system: 'x', operation: 'chat',
    request: { model: 'm' }, response: {}, usage: {}, performance: { duration: 1 },
  } as any);

  it('processEvaluations, getConverter, getMetrics, shutdown', async () => {
    const inst = new Eval2Otel({ serviceName: 'svc', useSdk: false } as any);
    expect(inst.getConverter()).toBeTruthy();
    expect(inst.getMetrics()).toBeTruthy();
    inst.processEvaluations([mkEval('i1'), mkEval('i2')]);
    await inst.shutdown();
  });

  it('createEval2Otel returns initialized instance', async () => {
    const inst = createEval2Otel({ serviceName: 'svc', useSdk: false } as any);
    inst.processEvaluations([mkEval('i3')]);
    await inst.shutdown();
  });
});
