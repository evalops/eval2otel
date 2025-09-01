import { Eval2Otel } from '../src/index';

describe('Eval2Otel error path', () => {
  it('processEvaluation catches and rethrows converter error', () => {
    const inst = new Eval2Otel({ serviceName: 'svc', useSdk: false } as any);
    expect(() => inst.processEvaluation({} as any)).toThrow();
  });
});

