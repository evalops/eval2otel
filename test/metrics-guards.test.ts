import { metrics as otMetrics } from '@opentelemetry/api';
import { Eval2OtelMetrics } from '../src/metrics';
import { EvalResult } from '../src/types';

describe('Metrics guardrails: allowlist and cap', () => {
  class FakeHistogram { public records: any[] = []; record(...args: any[]) { const [value, attrs] = args; this.records.push({ value, attrs }); } }
  class FakeMeter {
    histograms = new Map<string, FakeHistogram>();
    createHistogram(name: string) { const h = new FakeHistogram(); this.histograms.set(name, h); return h as any; }
    createCounter() { return { add: jest.fn() } as any; }
  }

  it('filters attributes by allowlist and caps attribute count', () => {
    const fake = new FakeMeter();
    jest.spyOn(otMetrics, 'getMeter').mockReturnValue(fake as any);
    const m = new Eval2OtelMetrics({
      serviceName: 'svc',
      enableExemplars: true,
      metricAttributeAllowlist: ['gen_ai.operation.name', 'gen_ai.system', 'gen_ai.request.model', 'gen_ai.token.type'],
      maxMetricAttributes: 3,
    } as any);

    const evalResult: EvalResult = {
      id: 'g1', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: { model: 'gpt-4o' }, usage: { inputTokens: 1, outputTokens: 2 }, performance: { duration: 1 },
    } as any;

    m.recordMetrics(evalResult);

    const tokenHist = fake.histograms.get('gen_ai.client.token.usage')!;
    expect(tokenHist.records.length).toBe(2);
    const attrs = tokenHist.records[0].attrs;
    // Only allowlisted keys remain and capped to 3 keys
    expect(Object.keys(attrs).sort()).toHaveLength(3);
    Object.keys(attrs).forEach(k => {
      expect(['gen_ai.operation.name', 'gen_ai.system', 'gen_ai.request.model', 'gen_ai.token.type']).toContain(k);
    });
  });
});

