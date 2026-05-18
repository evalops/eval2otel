import { deriveRagMetrics, getRagMetricValue } from '../src/rag';
import { EvalResult } from '../src/types';

describe('RAG derived metrics', () => {
  const rag: NonNullable<EvalResult['rag']> = {
    documentsRetrieved: 3,
    chunks: [
      { id: 'a', source: 'a.md', relevanceScore: 0.2, position: 0, tokens: 20 },
      { id: 'b', source: 'b.md', relevanceScore: 0.9, position: 1, tokens: 30, used: true, citationId: 'cite-1' },
      { id: 'c', source: 'c.md', relevanceScore: 0.4, position: 2, tokens: 50, used: true },
    ],
  };

  it('derives ranking, citation, relevance, and context-token metrics from chunks', () => {
    const metrics = deriveRagMetrics(rag);

    expect(metrics.retrievalUsedRatio).toBeCloseTo(2 / 3);
    expect(metrics.topKRelevanceMean).toBeCloseTo(0.5);
    expect(metrics.topKRelevanceMin).toBe(0.2);
    expect(metrics.citationCoverage).toBe(0.5);
    expect(metrics.meanReciprocalRank).toBe(0.5);
    expect(metrics.ndcg).toBeGreaterThan(0);
    expect(metrics.ndcg).toBeLessThan(1);
    expect(metrics.contextTokensUsed).toBe(80);
  });

  it('prefers explicit metric values when the adapter provides them', () => {
    expect(getRagMetricValue({
      ...rag,
      metrics: {
        meanReciprocalRank: 0.99,
        citationCoverage: 0.25,
      },
    }, 'meanReciprocalRank')).toBe(0.99);
    expect(getRagMetricValue(rag, 'contextTokensUsed')).toBe(80);
    expect(getRagMetricValue(undefined, 'ndcg')).toBeUndefined();
  });
});
