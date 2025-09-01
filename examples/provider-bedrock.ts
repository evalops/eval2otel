import { createEval2Otel, convertBedrockToEval2Otel } from '../src';
import * as fs from 'fs';
import * as readline from 'readline';

// Usage: ts-node examples/provider-bedrock.ts <bedrock.jsonl>
async function main() {
  const file = process.argv[2]; if (!file) { console.error('Usage: ts-node examples/provider-bedrock.ts <bedrock.jsonl>'); process.exit(1); }
  const inst = createEval2Otel({ serviceName: 'bedrock-replay', useSdk: false } as any);
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const obj = JSON.parse(line);
    const start = obj.startTime ?? Date.now();
    const end = obj.endTime ?? (start + 1);
    const evalRes = convertBedrockToEval2Otel(obj.request, obj.response, start, end);
    inst.processEvaluation(evalRes);
  }
  await inst.shutdown();
}
main().catch((e) => { console.error(e); process.exit(1); });
