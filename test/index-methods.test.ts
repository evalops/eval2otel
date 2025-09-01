import { Eval2Otel, createEval2Otel } from '../src/index';
import { EvalResult } from '../src/types';

describe('Eval2Otel class helper methods', () => {
  const base: EvalResult = {
    id: 'im1', timestamp: Date.now(), model: 'm', system: 'x', operation: 'chat',
    request: { model: 'm' }, response: {}, usage: {}, performance: { duration: 1 },
  } as any;

  it('processEvaluationWithMetrics does not throw and records metrics', () => {
    const eval2otel = new Eval2Otel({ serviceName: 'svc', useSdk: false } as any);
    expect(() => eval2otel.processEvaluationWithMetrics(base, { accuracy: 0.9 })).not.toThrow();
  });

  it('withSpan returns function value after processing evaluation', async () => {
    const eval2otel = createEval2Otel({ serviceName: 'svc', useSdk: false } as any);
    const result = await eval2otel.withSpan(base, async () => 'ok');
    expect(result).toBe('ok');
  });
});
