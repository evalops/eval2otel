import { metrics as otMetrics } from '@opentelemetry/api';
import { Eval2OtelMetrics } from '../src/metrics';
import { EvalResult } from '../src/types';

describe('Metrics recording branches', () => {
  class FakeHistogram {
    public records: { value: number; attributes: Record<string, unknown> }[] = [];
    record(value: number, attributes: Record<string, unknown>) {
      this.records.push({ value, attributes });
    }
  }
  class FakeMeter {
    histograms = new Map<string, FakeHistogram>();
    createHistogram(name: string) {
      const h = new FakeHistogram();
      this.histograms.set(name, h);
      return h as any;
    }
    createCounter() {
      return { add: jest.fn() } as any;
    }
  }

  it('records token, timing, RAG, agent, and custom metrics', () => {
    const fakeMeter = new FakeMeter();
    jest.spyOn(otMetrics, 'getMeter').mockReturnValue(fakeMeter as any);

    const evalMetrics = new Eval2OtelMetrics({ serviceName: 'svc' });
    const evalResult: EvalResult = {
      id: 'm1',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      request: { model: 'gpt-4' },
      response: {},
      usage: { inputTokens: 3, outputTokens: 5 },
      performance: { duration: 2, timeToFirstToken: 0.2, timePerOutputToken: 0.01 },
      agent: { name: 'agent', steps: [{ name: 's1', status: 'completed', duration: 100 }] },
      rag: {
        documentsRetrieved: 2,
        documentsUsed: 1,
        chunks: [
          { id: 'c1', source: 'a.md', relevanceScore: 0.4, position: 0, tokens: 12 },
          { id: 'c2', source: 'b.md', relevanceScore: 0.9, position: 1, tokens: 20, used: true, citationId: 'cite-2' },
        ],
        metrics: { contextPrecision: 0.8, contextRecall: 0.9, answerRelevance: 0.95, faithfulness: 0.9 },
      },
    } as any;

    evalMetrics.recordMetrics(evalResult, { metrics: { accuracy: 0.9, latency: 1.2 } });

    // Check some known histogram names got records
    const names = Array.from(fakeMeter.histograms.keys());
    expect(names).toEqual(expect.arrayContaining([
      'gen_ai.client.token.usage',
      'gen_ai.client.operation.duration',
      'gen_ai.server.time_to_first_token',
      'gen_ai.server.time_per_output_token',
      'gen_ai.agent.step_duration',
      'gen_ai.rag.mean_reciprocal_rank',
      'gen_ai.rag.ndcg',
      'gen_ai.rag.context_tokens_used',
      'eval.accuracy',
      'eval.latency',
    ]));

    const tokenHist = fakeMeter.histograms.get('gen_ai.client.token.usage')!;
    expect(tokenHist.records.length).toBe(2);
    const accHist = fakeMeter.histograms.get('eval.accuracy')!;
    expect(accHist.records[0].value).toBe(0.9);
    const mrrHist = fakeMeter.histograms.get('gen_ai.rag.mean_reciprocal_rank')!;
    expect(mrrHist.records[0].value).toBe(0.5);
    const contextTokenHist = fakeMeter.histograms.get('gen_ai.rag.context_tokens_used')!;
    expect(contextTokenHist.records[0].value).toBe(20);
  });
});
