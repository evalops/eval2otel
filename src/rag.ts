import { EvalResult } from './types';

export interface RagDerivedMetrics {
  retrievalUsedRatio?: number;
  topKRelevanceMean?: number;
  topKRelevanceMin?: number;
  citationCoverage?: number;
  meanReciprocalRank?: number;
  ndcg?: number;
  contextTokensUsed?: number;
}

export function deriveRagMetrics(rag: EvalResult['rag']): RagDerivedMetrics {
  if (!rag) return {};
  const chunks = rag.chunks ?? [];
  const relevanceScores = chunks
    .map(chunk => chunk.relevanceScore)
    .filter(score => Number.isFinite(score));
  const usedChunks = chunks.filter(chunk => chunk.used === true);
  const usedCount = rag.documentsUsed ?? usedChunks.length;
  const retrievedCount = rag.documentsRetrieved ?? chunks.length;

  return {
    retrievalUsedRatio: safeRatio(usedCount, retrievedCount),
    topKRelevanceMean: relevanceScores.length > 0
      ? relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length
      : undefined,
    topKRelevanceMin: relevanceScores.length > 0 ? Math.min(...relevanceScores) : undefined,
    citationCoverage: usedChunks.length > 0
      ? safeRatio(usedChunks.filter(chunk => Boolean(chunk.citationId)).length, usedChunks.length)
      : undefined,
    meanReciprocalRank: firstUsedRank(chunks),
    ndcg: normalizedDiscountedCumulativeGain(chunks),
    contextTokensUsed: rag.contextTokensUsed ?? sumTokens(chunks.filter(chunk => chunk.used === true)),
  };
}

export function getRagMetricValue(
  rag: EvalResult['rag'],
  metricName: keyof RagDerivedMetrics,
): number | undefined {
  if (!rag) return undefined;
  const explicit = (rag.metrics as Record<string, number | undefined> | undefined)?.[metricName];
  if (typeof explicit === 'number') return explicit;
  return deriveRagMetrics(rag)[metricName];
}

function safeRatio(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (typeof numerator !== 'number' || typeof denominator !== 'number' || denominator <= 0) return undefined;
  return numerator / denominator;
}

function firstUsedRank(chunks: NonNullable<EvalResult['rag']>['chunks']): number | undefined {
  const index = (chunks ?? []).findIndex(chunk => chunk.used === true);
  if (index < 0) return undefined;
  return 1 / (index + 1);
}

function normalizedDiscountedCumulativeGain(chunks: NonNullable<EvalResult['rag']>['chunks']): number | undefined {
  const scores = (chunks ?? []).map(chunk => chunk.relevanceScore).filter(score => Number.isFinite(score));
  if (scores.length === 0) return undefined;
  const dcg = discountedCumulativeGain(scores);
  const ideal = discountedCumulativeGain([...scores].sort((a, b) => b - a));
  return ideal > 0 ? dcg / ideal : undefined;
}

function discountedCumulativeGain(scores: number[]): number {
  return scores.reduce((sum, score, index) => sum + ((2 ** score) - 1) / Math.log2(index + 2), 0);
}

function sumTokens(chunks: NonNullable<EvalResult['rag']>['chunks']): number | undefined {
  const total = (chunks ?? []).reduce((sum, chunk) => sum + (chunk.tokens ?? 0), 0);
  return total > 0 ? total : undefined;
}
