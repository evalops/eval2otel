import { metrics as otMetrics } from '@opentelemetry/api';
import { Eval2OtelMetrics } from '../src/metrics';
import { EvalResult } from '../src/types';

describe('Metrics: environment attribute and custom metric types', () => {
  class FakeHistogram { public records: any[] = []; record(...args: any[]) { const [value, attrs] = args; this.records.push({ value, attrs }); } }
  class FakeMeter { histograms = new Map<string, FakeHistogram>(); createHistogram(n:string){ const h=new FakeHistogram(); this.histograms.set(n,h); return h as any; } createCounter(){ return { add: jest.fn() } as any; } }

  it('adds deployment.environment and merges options.attributes; custom metrics cover similarity and safety', () => {
    const fake = new FakeMeter();
    jest.spyOn(otMetrics, 'getMeter').mockReturnValue(fake as any);
    const m = new Eval2OtelMetrics({ serviceName: 'svc', environment: 'staging' } as any);
    const evalResult: EvalResult = {
      id: 'mx', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: { model: 'gpt-4o' }, usage: { inputTokens: 1 }, performance: { duration: 1 },
    } as any;
    m.recordMetrics(evalResult, { attributes: { foo: 'bar' }, metrics: { bleu: 0.8, toxicity: 0.1 } });
    const token = fake.histograms.get('gen_ai.client.token.usage')!;
    expect(token.records[0].attrs['deployment.environment']).toBe('staging');
    expect(token.records[0].attrs['foo']).toBe('bar');
    const bleu = fake.histograms.get('eval.bleu')!; // similarity branch
    const tox = fake.histograms.get('eval.toxicity')!; // safety branch
    expect(bleu.records[0].value).toBe(0.8);
    expect(tox.records[0].value).toBe(0.1);
  });
});

