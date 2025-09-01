#!/usr/bin/env node
/*
 * Minimal JSONL → OTLP replay CLI
 * Usage:
 *  npx eval2otel-cli ingest \
 *    --file ./evals.jsonl \
 *    --service-name evalops-evals \
 *    --endpoint http://localhost:4317 \
 *    --protocol grpc \
 *    --with-exemplars
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
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else if (!args._) {
      args._ = a;
    }
  }
  return args;
}

export async function runCli(argv: string[]) {
  const args = parseArgs(argv);
  const command = (args._ as string) || 'ingest';
  if (command !== 'ingest') {
    console.error('Unknown command. Supported: ingest');
    process.exit(1);
  }

  const file = (args['file'] as string) || (args['f'] as string);
  if (!file) {
    console.error('Missing --file <path.jsonl>');
    process.exit(1);
  }

  const serviceName = (args['service-name'] as string) || 'eval2otel-cli';
  const endpoint = args['endpoint'] as string | undefined;
  const protocol = (args['protocol'] as string | undefined) as OtelConfig['exporterProtocol'];
  const sampleRate = args['sample-rate'] ? Number(args['sample-rate']) : undefined;
  const contentCap = args['content-cap'] ? Number(args['content-cap']) : undefined;
  const providerOverride = args['provider-override'] as string | undefined;
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
    redact: redactPattern
      ? (content: string) => (new RegExp(redactPattern).test(content) ? null : content)
      : undefined,
  } as OtelConfig;

  const eval2otel = createEval2Otel(config);

  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      const evalResult: EvalResult = obj as EvalResult;
      if (providerOverride) {
        (evalResult as any).system = providerOverride;
      }
      if (dryRun) {
        // Print minimal summary
        console.log(`TRACE eval=${evalResult.id} op=${evalResult.operation} model=${evalResult.request?.model}`);
      } else {
        eval2otel.processEvaluation(evalResult);
      }
      count++;
    } catch (e) {
      console.error('Failed to parse line as JSON EvalResult:', e);
    }
  }

  if (!dryRun) {
    await eval2otel.shutdown();
  }
  console.log(`Processed ${count} evaluations${dryRun ? ' (dry-run)' : ''}`);
}

if (require.main === module) {
  runCli(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
