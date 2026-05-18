import { z } from 'zod';
import { EVAL2OTEL_CONTRACT_VERSION, sha256 } from '../contract';
import { ConversionWarning, EvalResult } from '../types';

const PromptfooAssertionSchema = z.object({
  type: z.string().optional(),
  metric: z.string().optional(),
  value: z.unknown().optional(),
  pass: z.boolean().optional(),
  score: z.number().optional(),
  reason: z.string().optional(),
}).passthrough();

const PromptfooResultSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  prompt: z.unknown().optional(),
  vars: z.record(z.string(), z.unknown()).optional(),
  provider: z.union([z.string(), z.object({
    id: z.string().optional(),
    label: z.string().optional(),
  }).passthrough()]).optional(),
  response: z.unknown().optional(),
  output: z.unknown().optional(),
  success: z.boolean().optional(),
  score: z.number().optional(),
  namedScores: z.record(z.string(), z.number()).optional(),
  latencyMs: z.number().optional(),
  gradingResult: z.object({
    pass: z.boolean().optional(),
    score: z.number().optional(),
    reason: z.string().optional(),
  }).passthrough().optional(),
  assertions: z.array(PromptfooAssertionSchema).optional(),
}).passthrough();

export interface PromptfooAdapterOptions {
  runId?: string;
  datasetId?: string;
  datasetVersion?: string;
  defaultModel?: string;
  defaultSystem?: string;
  timestamp?: number;
}

export interface PromptfooConversionResult {
  evalResults: EvalResult[];
  warnings: ConversionWarning[];
}

export function convertPromptfooToEvalResults(
  payload: unknown,
  options: PromptfooAdapterOptions = {},
): PromptfooConversionResult {
  const rows = extractPromptfooRows(payload);
  const warnings: ConversionWarning[] = [];
  const evalResults = rows.flatMap((row, index) => {
    const parsed = PromptfooResultSchema.safeParse(row);
    if (!parsed.success) {
      warnings.push({
        code: 'promptfoo.row_invalid',
        message: `Promptfoo row ${index} did not match the supported shape.`,
        severity: 'warning',
      });
      return [];
    }
    return [convertPromptfooResult(parsed.data, index, options)];
  });
  return { evalResults, warnings };
}

export function convertPromptfooResult(
  row: z.infer<typeof PromptfooResultSchema>,
  index: number,
  options: PromptfooAdapterOptions = {},
): EvalResult {
  const providerId = getProviderId(row.provider);
  const model = providerId ?? options.defaultModel ?? 'unknown';
  const output = row.response ?? row.output ?? '';
  const prompt = stringifyPrompt(row.prompt, row.vars);
  const assertions = row.assertions ?? [];
  const failedAssertions = assertions.filter(assertion => assertion.pass === false);
  const namedScores = row.namedScores ?? {};
  const score = row.score ?? row.gradingResult?.score;
  const success = row.success ?? row.gradingResult?.pass ?? failedAssertions.length === 0;
  const timestamp = options.timestamp ?? Date.now();
  const caseId = row.id !== undefined ? String(row.id) : `promptfoo-${index}`;
  const warnings = buildPromptfooWarnings(success, failedAssertions);

  return {
    id: `${options.runId ?? 'promptfoo'}-${caseId}`,
    timestamp,
    model,
    system: options.defaultSystem ?? providerId ?? 'promptfoo',
    operation: 'chat',
    request: {
      model,
    },
    response: {
      finishReasons: [success ? 'pass' : 'fail'],
      choices: [{
        index: 0,
        finishReason: success ? 'pass' : 'fail',
        message: {
          role: 'assistant',
          content: stringifyContent(output),
        },
      }],
    },
    usage: {},
    performance: {
      duration: typeof row.latencyMs === 'number' && row.latencyMs > 0 ? row.latencyMs / 1000 : 0.001,
    },
    conversation: prompt ? {
      id: `promptfoo-${caseId}`,
      messages: [{ role: 'user', content: prompt }],
    } : undefined,
    provider: {
      name: 'promptfoo',
      attributes: {
        'eval.promptfoo.success': success,
        ...(typeof score === 'number' ? { 'eval.promptfoo.score': score } : {}),
        'eval.promptfoo.assertion_count': assertions.length,
        'eval.promptfoo.failed_assertion_count': failedAssertions.length,
        ...(Object.keys(namedScores).length > 0 ? { 'eval.promptfoo.metric_names': Object.keys(namedScores) } : {}),
      },
    },
    provenance: {
      sourceFramework: 'promptfoo',
      runId: options.runId,
      caseId,
      datasetId: options.datasetId,
      datasetVersion: options.datasetVersion,
      adapter: 'promptfoo',
      adapterVersion: EVAL2OTEL_CONTRACT_VERSION,
      contractVersion: EVAL2OTEL_CONTRACT_VERSION,
    },
    evidence: {
      rawPayloadSha256: sha256(row),
      promptSha256: prompt ? sha256(prompt) : undefined,
      responseSha256: sha256(output),
      warningCount: warnings.length,
      warnings,
    },
  };
}

function extractPromptfooRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  const nestedResults = obj.results && typeof obj.results === 'object'
    ? (obj.results as Record<string, unknown>).results
    : undefined;
  if (Array.isArray(nestedResults)) return nestedResults;
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.table)) return obj.table;
  return [];
}

function getProviderId(provider: z.infer<typeof PromptfooResultSchema>['provider']): string | undefined {
  if (typeof provider === 'string') return provider;
  return provider?.id ?? provider?.label;
}

function stringifyPrompt(prompt: unknown, vars: Record<string, unknown> | undefined): string | undefined {
  if (typeof prompt === 'string') return prompt;
  if (prompt !== undefined) return JSON.stringify(prompt);
  if (vars && Object.keys(vars).length > 0) return JSON.stringify(vars);
  return undefined;
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content;
  return JSON.stringify(content ?? '');
}

function buildPromptfooWarnings(success: boolean, failedAssertions: Array<z.infer<typeof PromptfooAssertionSchema>>): ConversionWarning[] {
  if (success && failedAssertions.length === 0) return [];
  return failedAssertions.length > 0
    ? failedAssertions.map(assertion => ({
      code: 'promptfoo.assertion_failed',
      message: assertion.reason ?? assertion.type ?? assertion.metric ?? 'Promptfoo assertion failed.',
      severity: 'warning' as const,
    }))
    : [{
      code: 'promptfoo.case_failed',
      message: 'Promptfoo case failed without assertion detail.',
      severity: 'warning',
    }];
}
