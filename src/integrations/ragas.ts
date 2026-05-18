import { z } from 'zod';
import { EVAL2OTEL_CONTRACT_VERSION, sha256 } from '../contract';
import { ConversionWarning, EvalResult } from '../types';

type RagChunk = NonNullable<NonNullable<EvalResult['rag']>['chunks']>[number];

const RagasContextSchema = z.union([
  z.string(),
  z.object({
    id: z.union([z.string(), z.number()]).optional(),
    source: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    page_content: z.string().optional(),
    score: z.number().optional(),
    relevance_score: z.number().optional(),
    citation_id: z.string().optional(),
  }).passthrough(),
]);

const RagasResultSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  question: z.unknown().optional(),
  user_input: z.unknown().optional(),
  input: z.unknown().optional(),
  answer: z.unknown().optional(),
  response: z.unknown().optional(),
  output: z.unknown().optional(),
  ground_truth: z.unknown().optional(),
  reference: z.unknown().optional(),
  contexts: z.array(RagasContextSchema).optional(),
  retrieved_contexts: z.array(RagasContextSchema).optional(),
  context: z.array(RagasContextSchema).optional(),
  faithfulness: z.number().optional(),
  answer_relevancy: z.number().optional(),
  answer_relevance: z.number().optional(),
  context_precision: z.number().optional(),
  context_recall: z.number().optional(),
  context_entity_recall: z.number().optional(),
  latencyMs: z.number().optional(),
  latency_ms: z.number().optional(),
  duration: z.number().optional(),
}).passthrough();

export interface RagasAdapterOptions {
  runId?: string;
  datasetId?: string;
  datasetVersion?: string;
  defaultModel?: string;
  defaultSystem?: string;
  timestamp?: number;
}

export interface RagasConversionResult {
  evalResults: EvalResult[];
  warnings: ConversionWarning[];
}

export function convertRagasToEvalResults(
  payload: unknown,
  options: RagasAdapterOptions = {},
): RagasConversionResult {
  const rows = extractRagasRows(payload);
  const warnings: ConversionWarning[] = [];
  const evalResults = rows.flatMap((row, index) => {
    const parsed = RagasResultSchema.safeParse(row);
    if (!parsed.success) {
      warnings.push({
        code: 'ragas.row_invalid',
        message: `RAGAS row ${index} did not match the supported shape.`,
        severity: 'warning',
      });
      return [];
    }
    return [convertRagasResult(parsed.data, index, options)];
  });
  return { evalResults, warnings };
}

export function convertRagasResult(
  row: z.infer<typeof RagasResultSchema>,
  index: number,
  options: RagasAdapterOptions = {},
): EvalResult {
  const caseId = row.id !== undefined ? String(row.id) : `ragas-${index}`;
  const question = stringifyValue(row.user_input ?? row.question ?? row.input);
  const answer = stringifyValue(row.response ?? row.answer ?? row.output);
  const reference = stringifyValue(row.reference ?? row.ground_truth);
  const contexts = row.retrieved_contexts ?? row.contexts ?? row.context ?? [];
  const chunks = contexts.map((context, contextIndex) => toRagChunk(context, contextIndex));
  const metrics = {
    contextPrecision: row.context_precision,
    contextRecall: row.context_recall,
    answerRelevance: row.answer_relevance ?? row.answer_relevancy,
    faithfulness: row.faithfulness,
  };
  const metricAttributes = Object.fromEntries(
    Object.entries({
      'eval.ragas.faithfulness': row.faithfulness,
      'eval.ragas.context_precision': row.context_precision,
      'eval.ragas.context_recall': row.context_recall,
      'eval.ragas.answer_relevance': row.answer_relevance ?? row.answer_relevancy,
      'eval.ragas.context_entity_recall': row.context_entity_recall,
    }).filter(([, value]) => typeof value === 'number'),
  ) as Record<string, number>;

  return {
    id: `${options.runId ?? 'ragas'}-${caseId}`,
    timestamp: options.timestamp ?? Date.now(),
    model: options.defaultModel ?? 'unknown',
    system: options.defaultSystem ?? 'ragas',
    operation: 'chat',
    request: {
      model: options.defaultModel ?? 'unknown',
    },
    response: {
      finishReasons: ['evaluated'],
      choices: [{
        index: 0,
        finishReason: 'evaluated',
        message: {
          role: 'assistant',
          content: answer ?? '',
        },
      }],
    },
    usage: {},
    performance: {
      duration: durationSeconds(row),
    },
    conversation: question ? {
      id: `ragas-${caseId}`,
      messages: [{ role: 'user', content: question }],
    } : undefined,
    rag: {
      retrievalMethod: 'hybrid',
      documentsRetrieved: chunks.length,
      documentsUsed: chunks.length,
      chunks,
      metrics,
    },
    provider: {
      name: 'ragas',
      attributes: {
        ...metricAttributes,
        'eval.ragas.metric_names': Object.keys(metricAttributes).map(key => key.replace('eval.ragas.', '')),
        ...(reference ? { 'eval.ragas.reference_sha256': sha256(reference) } : {}),
      },
    },
    provenance: {
      sourceFramework: 'ragas',
      runId: options.runId,
      caseId,
      datasetId: options.datasetId,
      datasetVersion: options.datasetVersion,
      adapter: 'ragas',
      adapterVersion: EVAL2OTEL_CONTRACT_VERSION,
      contractVersion: EVAL2OTEL_CONTRACT_VERSION,
    },
    evidence: {
      rawPayloadSha256: sha256(row),
      promptSha256: question ? sha256(question) : undefined,
      responseSha256: answer ? sha256(answer) : undefined,
      warningCount: 0,
      warnings: [],
    },
  };
}

function extractRagasRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.scores)) return obj.scores;
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.rows)) return obj.rows;
  if (Array.isArray(obj.data)) return obj.data;
  return [obj];
}

function stringifyValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function toRagChunk(context: z.infer<typeof RagasContextSchema>, index: number): RagChunk {
  if (typeof context === 'string') {
    return {
      id: `ragas-context-${index}`,
      source: `ragas-context-${index}`,
      relevanceScore: 1,
      position: index,
      used: true,
      evidenceSha256: sha256(context),
    };
  }
  const content = context.text ?? context.content ?? context.page_content ?? JSON.stringify(context);
  return {
    id: context.id !== undefined ? String(context.id) : `ragas-context-${index}`,
    source: context.source ?? `ragas-context-${index}`,
    relevanceScore: context.relevance_score ?? context.score ?? 1,
    position: index,
    used: true,
    citationId: context.citation_id,
    evidenceSha256: sha256(content),
  };
}

function durationSeconds(row: z.infer<typeof RagasResultSchema>): number {
  if (typeof row.duration === 'number' && row.duration > 0) return row.duration;
  const latencyMs = row.latencyMs ?? row.latency_ms;
  return typeof latencyMs === 'number' && latencyMs > 0 ? latencyMs / 1000 : 0.001;
}
