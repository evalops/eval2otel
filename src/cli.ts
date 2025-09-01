#!/usr/bin/env node
/*
 * Minimal JSONL → OTLP replay CLI
 * Usage: npx eval2otel-cli ingest --file ./evals.jsonl [--provider <mode>]
 */
import { createEval2Otel, EvalResult, OtelConfig } from './index';
import * as fs from 'fs';
import * as readline from 'readline';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else if (!args._) {
      args._ = a;
    }
  }
  return args;
}

export async function runCli(argv: string[]) {
  const args = parseArgs(argv);
  const command = (args._ as string) || 'ingest';
  if (command !== 'ingest') { console.error('Unknown command. Supported: ingest'); process.exit(1); }

  const file = (args['file'] as string) || (args['f'] as string);
  if (!file) { console.error('Missing --file <path.jsonl>'); process.exit(1); }

  const serviceName = (args['service-name'] as string) || 'eval2otel-cli';
  const endpoint = args['endpoint'] as string | undefined;
  const protocol = (args['protocol'] as string | undefined) as OtelConfig['exporterProtocol'];
  const sampleRate = args['sample-rate'] ? Number(args['sample-rate']) : undefined;
  const contentCap = args['content-cap'] ? Number(args['content-cap']) : undefined;
  const providerOverride = args['provider-override'] as string | undefined;
  const providerMode = args['provider'] as string | undefined; // openai-chat | openai-compatible | anthropic | cohere | bedrock | vertex | ollama
  const noFallback = Boolean(args['autodetect-strict'] || args['no-fallback']);
  const dryRun = Boolean(args['dry-run']);
  const withExemplars = Boolean(args['with-exemplars']);
  const redactPattern = args['redact-pattern'] as string | undefined;

  const config: OtelConfig = {
    serviceName,
    endpoint,
    exporterProtocol: protocol,
    captureContent: true,
    sampleContentRate: sampleRate ?? 1.0,
    contentMaxLength: contentCap,
    enableExemplars: withExemplars,
    redact: redactPattern ? (content: string) => (new RegExp(redactPattern).test(content) ? null : content) : undefined,
  } as OtelConfig;

  const eval2otel = createEval2Otel(config);
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      let evalResult: EvalResult | null = null;
      if (obj && typeof obj === 'object' && (obj.request || obj.response)) {
        const start = (obj.startTime as number) || Date.now();
        const end = (obj.endTime as number) || (start + 1000);
        const { request, response } = obj as any;
        let prov: any; try { prov = await import('./providers'); } catch { prov = require('./providers'); }
        const detected = (() => {
          if (response?.object === 'chat.completion' || response?.system_fingerprint) return 'openai-chat';
          if (Array.isArray(response?.choices) && response?.choices?.[0]?.message?.tool_calls && typeof response?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments === 'string') return 'openai-compatible';
          if (response?.modelId || request?.modelId) return 'bedrock';
          if (Array.isArray(response?.candidates)) return 'vertex';
          if (Array.isArray(response?.content) && response?.content?.some((c: any) => c?.type === 'tool_use')) return 'anthropic';
          if (typeof response?.text === 'string' && response?.meta?.billed_units) return 'cohere';
          if (response?.message?.role && (response?.eval_duration || response?.load_duration || response?.prompt_eval_count)) return 'ollama';
          return 'unknown';
        })();
        const mode = providerMode?.toLowerCase() ?? detected;
        if (providerMode && !['openai-chat','openai-compatible','anthropic','cohere','bedrock','vertex','ollama'].includes(mode)) {
          throw new Error(`Unknown --provider value: ${providerMode}`);
        }
        if (mode !== 'unknown') {
          switch (mode) {
            case 'openai-chat': evalResult = prov.convertOpenAIChatToEval2Otel(request, response, start, end); break;
            case 'openai-compatible': evalResult = prov.convertOpenAICompatibleToEval2Otel(request, response, start, end, { system: 'openai' }); break;
            case 'anthropic': evalResult = prov.convertAnthropicToEval2Otel(request, response, start, end); break;
            case 'cohere': evalResult = prov.convertCohereToEval2Otel(request, response, start, end); break;
            case 'bedrock': evalResult = prov.convertBedrockToEval2Otel(request, response, start, end); break;
            case 'vertex': evalResult = prov.convertVertexToEval2Otel(request, response, start, end); break;
            case 'ollama': evalResult = prov.convertOllamaToEval2Otel(request, response, start); break;
          }
        }
        if (!evalResult) {
          if (!providerMode && detected === 'unknown' && noFallback) {
            throw new Error('Autodetect failed and fallback disabled');
          }
          evalResult = obj as EvalResult;
          if (providerOverride) (evalResult as any).system = providerOverride;
        }
      } else {
        evalResult = obj as EvalResult;
        if (providerOverride) (evalResult as any).system = providerOverride;
      }
      if (!evalResult) throw new Error('Unable to build EvalResult from input line');
      if (dryRun) console.log(`TRACE eval=${evalResult.id} op=${evalResult.operation} model=${evalResult.request?.model}`);
      else eval2otel.processEvaluation(evalResult);
      count++;
    } catch (e) {
      console.error('Failed to parse/process line:', e);
    }
  }
  if (!dryRun) await eval2otel.shutdown();
  console.log(`Processed ${count} evaluations${dryRun ? ' (dry-run)' : ''}`);
}

if (require.main === module) {
  runCli(process.argv).catch((err) => { console.error(err); process.exit(1); });
}
