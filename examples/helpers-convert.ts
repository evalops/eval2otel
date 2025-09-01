import { createEval2Otel, detectProvider, convertAnyProvider } from '../src';
import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: ts-node examples/helpers-convert.ts <provider-jsonl>');
    process.exit(1);
  }
  const inst = createEval2Otel({ serviceName: 'helpers-convert', useSdk: false } as any);
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    const { request, response, startTime, endTime } = obj;
    const mode = detectProvider(request, response);
    const evalRes = convertAnyProvider({ request, response, startTime, endTime, provider: mode });
    if (evalRes) inst.processEvaluation(evalRes);
  }
  await inst.shutdown();
}

main().catch((e) => { console.error(e); process.exit(1); });
