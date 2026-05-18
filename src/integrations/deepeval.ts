import { z } from 'zod';
import { EVAL2OTEL_CONTRACT_VERSION, sha256 } from '../contract';
import { ConversionWarning, EvalResult } from '../types';

const DeepEvalMetricSchema = z.object({
  name: z.string().optional(),
  metric: z.string().optional(),
  score: z.number().optional(),
  threshold: z.number().optional(),
  success: z.boolean().optional(),
  passed: z.boolean().optional(),
  reason: z.string().optional(),
  explanation: z.string().optional(),
}).passthrough();

const DeepEvalResultSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  testCaseId: z.union([z.string(), z.number()]).optional(),
  input: z.unknown().optional(),
  actualOutput: z.unknown().optional(),
  actual_output: z.unknown().optional(),
  output: z.unknown().optional(),
  expectedOutput: z.unknown().optional(),
  expected_output: z.unknown().optional(),
  context: z.array(z.unknown()).optional(),
  retrievalContext: z.array(z.unknown()).optional(),
  retrieval_context: z.array(z.unknown()).optional(),
  metrics: z.union([z.array(DeepEvalMetricSchema), z.record(z.string(), z.unknown())]).optional(),
  success: z.boolean().optional(),
  passed: z.boolean().optional(),
  latencyMs: z.number().optional(),
  latency_ms: z.number().optional(),
  duration: z.number().optional(),
}).passthrough();

interface NormalizedMetric {
  name: string;
  score?: number;
  success?: boolean;
  reason?: string;
}

export interface DeepEvalAdapterOptions {
  runId?: string;
  datasetId?: string;
  datasetVersion?: string;
  defaultModel?: string;
  defaultSystem?: string;
  timestamp?: number;
  includeExplanations?: boolean;
}

export interface DeepEvalConversionResult {
  evalResults: EvalResult[];
  warnings: ConversionWarning[];
}

export function convertDeepEvalToEvalResults(
  payload: unknown,
  options: DeepEvalAdapterOptions = {},
): DeepEvalConversionResult {
  const rows = extractDeepEvalRows(payload);
  const warnings: ConversionWarning[] = [];
  const evalResults = rows.flatMap((row, index) => {
    const parsed = DeepEvalResultSchema.safeParse(row);
    if (!parsed.success) {
      warnings.push({
        code: 'deepeval.row_invalid',
        message: `DeepEval row ${index} did not match the supported shape.`,
        severity: 'warning',
      });
      return [];
    }
    return [convertDeepEvalResult(parsed.data, index, options)];
  });
  return { evalResults, warnings };
}

export function convertDeepEvalResult(
  row: z.infer<typeof DeepEvalResultSchema>,
  index: number,
  options: DeepEvalAdapterOptions = {},
): EvalResult {
  const caseId = row.testCaseId !== undefined ? String(row.testCaseId)
    : row.id !== undefined ? String(row.id)
      : `deepeval-${index}`;
  const input = stringifyValue(row.input);
  const output = stringifyValue(row.actualOutput ?? row.actual_output ?? row.output);
  const expected = stringifyValue(row.expectedOutput ?? row.expected_output);
  const metrics = normalizeMetrics(row.metrics);
  const failedMetrics = metrics.filter(metric => metric.success === false);
  const success = row.success ?? row.passed ?? failedMetrics.length === 0;
  const warnings = buildDeepEvalWarnings(failedMetrics, options.includeExplanations === true);
  const retrievalContexts = row.retrievalContext ?? row.retrieval_context ?? row.context ?? [];

  return {
    id: `${options.runId ?? 'deepeval'}-${caseId}`,
    timestamp: options.timestamp ?? Date.now(),
    model: options.defaultModel ?? 'unknown',
    system: options.defaultSystem ?? 'deepeval',
    operation: retrievalContexts.length > 0 ? 'chat' : 'text_completion',
    request: {
      model: options.defaultModel ?? 'unknown',
    },
    response: {
      finishReasons: [success ? 'pass' : 'fail'],
      choices: [{
        index: 0,
        finishReason: success ? 'pass' : 'fail',
        message: {
          role: 'assistant',
          content: output ?? '',
        },
      }],
    },
    usage: {},
    performance: {
      duration: durationSeconds(row),
    },
    conversation: input ? {
      id: `deepeval-${caseId}`,
      messages: [{ role: 'user', content: input }],
    } : undefined,
    rag: retrievalContexts.length > 0 ? {
      retrievalMethod: 'hybrid',
      documentsRetrieved: retrievalContexts.length,
      documentsUsed: retrievalContexts.length,
      chunks: retrievalContexts.map((context, contextIndex) => ({
        id: `deepeval-context-${contextIndex}`,
        source: `deepeval-context-${contextIndex}`,
        relevanceScore: 1,
        position: contextIndex,
        used: true,
        evidenceSha256: sha256(context),
      })),
    } : undefined,
    provider: {
      name: 'deepeval',
      attributes: {
        'eval.deepeval.success': success,
        'eval.deepeval.metric_names': metrics.map(metric => metric.name),
        'eval.deepeval.failed_metric_count': failedMetrics.length,
        ...(expected ? { 'eval.deepeval.expected_sha256': sha256(expected) } : {}),
        ...Object.fromEntries(metrics
          .filter(metric => typeof metric.score === 'number')
          .map(metric => [`eval.deepeval.${normalizeMetricName(metric.name)}`, metric.score])),
      },
    },
    provenance: {
      sourceFramework: 'deepeval',
      runId: options.runId,
      caseId,
      datasetId: options.datasetId,
      datasetVersion: options.datasetVersion,
      adapter: 'deepeval',
      adapterVersion: EVAL2OTEL_CONTRACT_VERSION,
      contractVersion: EVAL2OTEL_CONTRACT_VERSION,
    },
    evidence: {
      rawPayloadSha256: sha256(row),
      promptSha256: input ? sha256(input) : undefined,
      responseSha256: output ? sha256(output) : undefined,
      warningCount: warnings.length,
      warnings,
    },
  };
}

function extractDeepEvalRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.testResults)) return obj.testResults;
  if (Array.isArray(obj.test_results)) return obj.test_results;
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.rows)) return obj.rows;
  return [obj];
}

function normalizeMetrics(metrics: z.infer<typeof DeepEvalResultSchema>['metrics']): NormalizedMetric[] {
  if (!metrics) return [];
  if (Array.isArray(metrics)) {
    return metrics.flatMap((metric, index) => {
      const name = metric.name ?? metric.metric ?? `metric_${index}`;
      return [{
        name,
        score: metric.score,
        success: metric.success ?? metric.passed,
        reason: metric.reason ?? metric.explanation,
      }];
    });
  }
  return Object.entries(metrics).flatMap<NormalizedMetric>(([name, value]) => {
    if (typeof value === 'number') return [{ name, score: value }];
    if (typeof value === 'boolean') return [{ name, success: value }];
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return [{
        name,
        score: typeof obj.score === 'number' ? obj.score : undefined,
        success: typeof obj.success === 'boolean' ? obj.success : typeof obj.passed === 'boolean' ? obj.passed : undefined,
        reason: typeof obj.reason === 'string' ? obj.reason : typeof obj.explanation === 'string' ? obj.explanation : undefined,
      }];
    }
    return [];
  });
}

function buildDeepEvalWarnings(metrics: NormalizedMetric[], includeExplanations: boolean): ConversionWarning[] {
  return metrics.map(metric => ({
    code: 'deepeval.metric_failed',
    message: includeExplanations && metric.reason ? `${metric.name}: ${metric.reason}` : `${metric.name} failed.`,
    severity: 'warning' as const,
  }));
}

function stringifyValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeMetricName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'metric';
}

function durationSeconds(row: z.infer<typeof DeepEvalResultSchema>): number {
  if (typeof row.duration === 'number' && row.duration > 0) return row.duration;
  const latencyMs = row.latencyMs ?? row.latency_ms;
  return typeof latencyMs === 'number' && latencyMs > 0 ? latencyMs / 1000 : 0.001;
}
