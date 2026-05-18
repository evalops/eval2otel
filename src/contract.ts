import { createHash } from 'crypto';
import { ATTR } from './attributes';
import {
  ConversionReport,
  ConversionWarning,
  Eval2OtelEvidence,
  EvalResult,
  OtelConfig,
} from './types';

export const EVAL2OTEL_CONTRACT_VERSION = 'eval2otel.v1';
export const UNKNOWN_SEMCONV_VERSION = 'unspecified';

export interface ConversionCounters {
  eventCount?: number;
  droppedEventCount?: number;
  redactedContentCount?: number;
  truncatedContentCount?: number;
  durationMs?: number;
}

export function sha256(value: unknown): string {
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(encoded ?? '').digest('hex');
}

export function normalizeProviderName(system?: string): string | undefined {
  if (!system) return undefined;
  const s = system.toLowerCase();
  if (s.includes('azure')) return 'azure.openai';
  if (s.includes('bedrock') || s.includes('aws')) return 'aws.bedrock';
  if (s.includes('vertex') || s.includes('gemini') || s.includes('google')) return 'google.vertex';
  if (s.includes('anthropic') || s.includes('claude')) return 'anthropic';
  if (s.includes('openai')) return 'openai';
  return s;
}

export function resolveSemconvVersion(config: OtelConfig, evalResult?: EvalResult): string {
  return evalResult?.provenance?.semconvVersion
    ?? config.semconvGaVersion
    ?? config.semconvStabilityOptIn
    ?? UNKNOWN_SEMCONV_VERSION;
}

export function collectConversionWarnings(evalResult: EvalResult): ConversionWarning[] {
  return evalResult.evidence?.warnings ?? [];
}

export function buildEval2OtelEvidence(
  evalResult: EvalResult,
  counters: ConversionCounters = {},
): Eval2OtelEvidence {
  const warnings = collectConversionWarnings(evalResult);
  return {
    rawPayloadSha256: evalResult.evidence?.rawPayloadSha256,
    promptSha256: evalResult.evidence?.promptSha256 ?? hashPrompt(evalResult),
    responseSha256: evalResult.evidence?.responseSha256 ?? hashResponse(evalResult),
    redactedContentCount: counters.redactedContentCount ?? evalResult.evidence?.redactedContentCount ?? 0,
    truncatedContentCount: counters.truncatedContentCount ?? evalResult.evidence?.truncatedContentCount ?? 0,
    droppedEventCount: counters.droppedEventCount ?? evalResult.evidence?.droppedEventCount ?? 0,
    warningCount: counters.eventCount === undefined
      ? (evalResult.evidence?.warningCount ?? warnings.length)
      : (evalResult.evidence?.warningCount ?? warnings.length),
    warnings,
  };
}

export function buildEval2OtelAttributes(
  evalResult: EvalResult,
  config: OtelConfig,
  counters: ConversionCounters = {},
): Record<string, string | number | boolean | string[]> {
  const evidence = buildEval2OtelEvidence(evalResult, counters);
  const provenance = evalResult.provenance;
  const attrs: Record<string, string | number | boolean | string[]> = {
    [ATTR.CONTRACT_VERSION]: provenance?.contractVersion ?? EVAL2OTEL_CONTRACT_VERSION,
    [ATTR.SEMCONV_VERSION]: resolveSemconvVersion(config, evalResult),
    [ATTR.EVAL_ID]: evalResult.id,
    [ATTR.WARNING_COUNT]: evidence.warningCount ?? 0,
    [ATTR.DROPPED_EVENT_COUNT]: evidence.droppedEventCount ?? 0,
    [ATTR.REDACTED_CONTENT_COUNT]: evidence.redactedContentCount ?? 0,
    [ATTR.TRUNCATED_CONTENT_COUNT]: evidence.truncatedContentCount ?? 0,
  };

  addString(attrs, ATTR.SOURCE_FRAMEWORK, provenance?.sourceFramework);
  addString(attrs, ATTR.RUN_ID, provenance?.runId);
  addString(attrs, ATTR.CASE_ID, provenance?.caseId);
  addString(attrs, ATTR.DATASET_ID, provenance?.datasetId);
  addString(attrs, ATTR.DATASET_VERSION, provenance?.datasetVersion);
  addString(attrs, ATTR.ADAPTER_NAME, provenance?.adapter);
  addString(attrs, ATTR.ADAPTER_VERSION, provenance?.adapterVersion);
  addString(attrs, ATTR.RAW_PAYLOAD_SHA256, evidence.rawPayloadSha256);
  addString(attrs, ATTR.PROMPT_SHA256, evidence.promptSha256);
  addString(attrs, ATTR.RESPONSE_SHA256, evidence.responseSha256);

  return attrs;
}

export function buildConversionReport(
  evalResult: EvalResult,
  config: OtelConfig,
  spanName: string,
  counters: ConversionCounters = {},
): ConversionReport {
  const evidence = buildEval2OtelEvidence(evalResult, counters);
  const warnings = collectConversionWarnings(evalResult);
  return {
    evalId: evalResult.id,
    success: true,
    contractVersion: evalResult.provenance?.contractVersion ?? EVAL2OTEL_CONTRACT_VERSION,
    semconvVersion: resolveSemconvVersion(config, evalResult),
    spanName,
    eventCount: counters.eventCount ?? 0,
    droppedEventCount: evidence.droppedEventCount ?? 0,
    redactedContentCount: evidence.redactedContentCount ?? 0,
    truncatedContentCount: evidence.truncatedContentCount ?? 0,
    warningCount: evidence.warningCount ?? warnings.length,
    warnings,
    durationMs: counters.durationMs ?? 0,
  };
}

export function buildFailureConversionReport(
  evalResult: Partial<EvalResult> | undefined,
  config: OtelConfig,
  error: unknown,
  durationMs: number,
): ConversionReport {
  const errorType = error instanceof Error ? error.name : typeof error;
  return {
    evalId: evalResult?.id ?? 'unknown',
    success: false,
    contractVersion: evalResult?.provenance?.contractVersion ?? EVAL2OTEL_CONTRACT_VERSION,
    semconvVersion: evalResult ? resolveSemconvVersion(config, evalResult as EvalResult) : UNKNOWN_SEMCONV_VERSION,
    eventCount: 0,
    droppedEventCount: 0,
    redactedContentCount: 0,
    truncatedContentCount: 0,
    warningCount: 1,
    warnings: [{
      code: 'conversion.failed',
      message: error instanceof Error ? error.message : String(error),
      severity: 'error',
    }],
    durationMs,
    errorType,
  };
}

function hashPrompt(evalResult: EvalResult): string | undefined {
  if (!evalResult.conversation?.messages?.length) return undefined;
  return sha256(evalResult.conversation.messages.map(message => ({
    role: message.role,
    content: message.content,
    toolCallId: message.toolCallId,
  })));
}

function hashResponse(evalResult: EvalResult): string | undefined {
  if (!evalResult.response) return undefined;
  return sha256(evalResult.response);
}

function addString(
  attrs: Record<string, string | number | boolean | string[]>,
  key: string,
  value: string | undefined,
): void {
  if (value) attrs[key] = value;
}
