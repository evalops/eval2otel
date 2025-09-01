import { EvalResult } from './types';
import {
  convertOpenAIChatToEval2Otel,
  convertOpenAICompatibleToEval2Otel,
  convertAnthropicToEval2Otel,
  convertCohereToEval2Otel,
  convertBedrockToEval2Otel,
  convertVertexToEval2Otel,
  convertOllamaToEval2Otel,
} from './providers';

export type ProviderMode =
  | 'openai-chat'
  | 'openai-compatible'
  | 'anthropic'
  | 'cohere'
  | 'bedrock'
  | 'vertex'
  | 'ollama'
  | 'unknown';

export function detectProvider(request: any, response: any): ProviderMode {
  if (response?.object === 'chat.completion' || response?.system_fingerprint) return 'openai-chat';
  if (Array.isArray(response?.choices) && response?.choices?.[0]?.message?.tool_calls && typeof response?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments === 'string') return 'openai-compatible';
  if (response?.modelId || request?.modelId) return 'bedrock';
  if (Array.isArray(response?.candidates)) return 'vertex';
  if (Array.isArray(response?.content) && response?.content?.some((c: any) => c?.type === 'tool_use')) return 'anthropic';
  if (typeof response?.text === 'string' && response?.meta?.billed_units) return 'cohere';
  if (response?.message?.role && (response?.eval_duration || response?.load_duration || response?.prompt_eval_count)) return 'ollama';
  return 'unknown';
}

export function convertProviderToEvalResult(
  request: any,
  response: any,
  startTime: number,
  endTime: number,
  mode?: ProviderMode
): EvalResult | null {
  const m = mode && mode !== 'unknown' ? mode : detectProvider(request, response);
  switch (m) {
    case 'openai-chat':
      return convertOpenAIChatToEval2Otel(request, response, startTime, endTime);
    case 'openai-compatible':
      return convertOpenAICompatibleToEval2Otel(request, response, startTime, endTime, { system: 'openai' });
    case 'anthropic':
      return convertAnthropicToEval2Otel(request, response, startTime, endTime);
    case 'cohere':
      return convertCohereToEval2Otel(request, response, startTime, endTime);
    case 'bedrock':
      return convertBedrockToEval2Otel(request, response, startTime, endTime);
    case 'vertex':
      return convertVertexToEval2Otel(request, response, startTime, endTime);
    case 'ollama':
      // Ollama converter does not use endTime
      return convertOllamaToEval2Otel(request, response, startTime);
    default:
      return null;
  }
}

/**
 * Convenience: accept a combined payload and optionally a provider mode.
 */
export function convertAnyProvider(payload: {
  request: any;
  response: any;
  startTime: number;
  endTime?: number;
  provider?: ProviderMode | string;
}): EvalResult | null {
  const { request, response, startTime } = payload;
  const endTime = payload.endTime ?? startTime + 1;
  const mode = (payload.provider as ProviderMode) ?? detectProvider(request, response);
  return convertProviderToEvalResult(request, response, startTime, endTime, mode);
}

export function isProviderKnown(mode: string | undefined): boolean {
  if (!mode) return false;
  return ['openai-chat','openai-compatible','anthropic','cohere','bedrock','vertex','ollama'].includes(mode as string);
}

export function listSupportedProviders(): ProviderMode[] {
  return ['openai-chat','openai-compatible','anthropic','cohere','bedrock','vertex','ollama'];
}
