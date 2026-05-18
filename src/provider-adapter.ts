import {
  convertAnthropicToEval2Otel,
  convertBedrockToEval2Otel,
  convertCohereToEval2Otel,
  convertOllamaToEval2Otel,
  convertOpenAIChatToEval2Otel,
  convertOpenAICompatibleToEval2Otel,
  convertVertexToEval2Otel,
} from './providers';
import { EVAL2OTEL_CONTRACT_VERSION, sha256 } from './contract';
import {
  ConversionWarning,
  ProviderAdapter,
  ProviderAdapterInput,
  ProviderConversionResult,
} from './types';

export const PROVIDER_ADAPTER_MODES = [
  'openai-chat',
  'openai-compatible',
  'anthropic',
  'cohere',
  'bedrock',
  'vertex',
  'ollama',
] as const;

export type KnownProviderAdapterMode = typeof PROVIDER_ADAPTER_MODES[number];

const converters: Record<KnownProviderAdapterMode, (input: ProviderAdapterInput) => ReturnType<typeof convertOpenAIChatToEval2Otel>> = {
  'openai-chat': input => convertOpenAIChatToEval2Otel(input.request as any, input.response as any, input.startTime, input.endTime ?? input.startTime + 1),
  'openai-compatible': input => convertOpenAICompatibleToEval2Otel(input.request as any, input.response as any, input.startTime, input.endTime ?? input.startTime + 1, { system: 'openai' }),
  anthropic: input => convertAnthropicToEval2Otel(input.request as any, input.response as any, input.startTime, input.endTime ?? input.startTime + 1),
  cohere: input => convertCohereToEval2Otel(input.request as any, input.response as any, input.startTime, input.endTime ?? input.startTime + 1),
  bedrock: input => convertBedrockToEval2Otel(input.request as any, input.response as any, input.startTime, input.endTime ?? input.startTime + 1),
  vertex: input => convertVertexToEval2Otel(input.request as any, input.response as any, input.startTime, input.endTime ?? input.startTime + 1),
  ollama: input => convertOllamaToEval2Otel(input.request as any, input.response as any, input.startTime),
};

export function createProviderAdapter(mode: KnownProviderAdapterMode): ProviderAdapter {
  return {
    mode,
    convert(input: ProviderAdapterInput): ProviderConversionResult {
      const warnings: ConversionWarning[] = [];
      try {
        const evalResult = converters[mode](input);
        const evidence = {
          ...evalResult.evidence,
          rawPayloadSha256: evalResult.evidence?.rawPayloadSha256 ?? sha256({ request: input.request, response: input.response }),
          warningCount: warnings.length,
          warnings,
        };
        return {
          mode,
          confidence: 'explicit',
          evalResult: {
            ...evalResult,
            provenance: {
              ...evalResult.provenance,
              sourceFramework: evalResult.provenance?.sourceFramework ?? 'provider-native',
              adapter: evalResult.provenance?.adapter ?? mode,
              adapterVersion: evalResult.provenance?.adapterVersion ?? EVAL2OTEL_CONTRACT_VERSION,
              contractVersion: evalResult.provenance?.contractVersion ?? EVAL2OTEL_CONTRACT_VERSION,
            },
            evidence,
          },
          warnings,
          evidence,
        };
      } catch (error) {
        warnings.push({
          code: 'provider.conversion_exception',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
        });
        return {
          mode,
          confidence: 'explicit',
          evalResult: null,
          warnings,
          evidence: {
            rawPayloadSha256: sha256({ request: input.request, response: input.response }),
            warningCount: warnings.length,
            warnings,
          },
        };
      }
    },
  };
}

export function isKnownProviderAdapterMode(mode: string): mode is KnownProviderAdapterMode {
  return (PROVIDER_ADAPTER_MODES as readonly string[]).includes(mode);
}
