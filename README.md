# Eval2Otel

[![npm version](https://badge.fury.io/js/eval2otel.svg)](https://badge.fury.io/js/eval2otel)
[![codecov](https://codecov.io/gh/evalops/eval2otel/branch/main/graph/badge.svg)](https://codecov.io/gh/evalops/eval2otel)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-GenAI%20Conventions-blue)](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Eval2Otel turns AI evaluation results and provider-native payloads into
OpenTelemetry GenAI spans, events, metrics, and audit attributes. It is built
for eval pipelines that need production observability without leaking prompt
content by default.

## What You Get

- OpenTelemetry GenAI spans: `gen_ai.chat`, `gen_ai.embeddings`, `gen_ai.execute_tool`, `gen_ai.agent`, and `gen_ai.workflow`
- Provider adapters for OpenAI chat, OpenAI-compatible APIs, Anthropic, Cohere, AWS Bedrock, Google Vertex, and Ollama
- Framework adapters for Promptfoo, RAGAS, and DeepEval with run, case, dataset, score, provenance, and evidence metadata
- RAG scoring for context precision, recall, faithfulness, MRR, NDCG, citation coverage, top-k relevance, and context-token use
- Privacy controls for opt-in content capture, redaction-to-string, redaction-to-fingerprint, truncation flags, and event caps
- A versioned `eval2otel.v1` contract backed by conformance fixtures
- Operational telemetry about Eval2Otel itself: conversion count, warnings, dropped events, redactions, truncations, and duration
- A Python SDK preview with optional OTLP spans, content events, PII redaction, and provider instrumentation hooks

## Install

```bash
npm install eval2otel
```

Requirements:

- Node.js 16+
- TypeScript 5+ for TypeScript projects
- An OpenTelemetry collector or SDK if you want to export telemetry immediately

## Quick Start

```ts
import { createEval2Otel, type EvalResult } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'eval-runner',
  serviceVersion: '1.0.0',
  captureContent: false,
  endpoint: 'http://localhost:4318',
  exporterProtocol: 'http/protobuf',
});

const result: EvalResult = {
  id: 'case-123',
  timestamp: Date.now(),
  model: 'gpt-4o-mini',
  system: 'openai',
  operation: 'chat',
  request: {
    model: 'gpt-4o-mini',
    temperature: 0.2,
  },
  response: {
    id: 'resp-123',
    finishReasons: ['stop'],
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: 'The answer is grounded in the supplied release notes.',
      },
    }],
  },
  usage: {
    inputTokens: 120,
    outputTokens: 18,
  },
  performance: {
    duration: 0.82,
  },
  provenance: {
    sourceFramework: 'promptfoo',
    runId: 'nightly-2026-05-18',
    caseId: 'case-123',
    datasetId: 'release-evals',
    datasetVersion: '2026.05',
  },
};

eval2otel.processEvaluation(result);
await eval2otel.shutdown();
```

Content capture is off by default. You still get model, timing, token, contract,
provider, provenance, and conversion telemetry without storing prompts or
responses.

## Contract, Provenance, And Evidence

Eval2Otel emits a stable contract namespace alongside GenAI semantic convention
attributes:

- `evalops.contract.version`
- `evalops.semconv.version`
- `evalops.eval.id`
- `evalops.source.framework`
- `evalops.run.id`
- `evalops.case.id`
- `evalops.dataset.id`
- `evalops.adapter.name`
- `evalops.raw_payload_sha256`
- `evalops.warning_count`
- `evalops.redacted_content_count`
- `evalops.truncated_content_count`
- `evalops.dropped_event_count`

The contract is documented in
[docs/contract/eval2otel-v1.md](./docs/contract/eval2otel-v1.md) and enforced by
golden fixtures in [test/fixtures/conformance](./test/fixtures/conformance).
Those fixtures include normal chat, RAG event caps, tool argument truncation,
redaction-to-fingerprint, and oversized payload cases.

## Provider Adapters

Use provider adapters when you have raw provider request and response payloads
instead of an `EvalResult` already shaped by your evaluation framework.

```ts
import { convertProviderWithEvidence } from 'eval2otel';

const converted = convertProviderWithEvidence({
  provider: 'openai-chat',
  startTime: Date.now(),
  endTime: Date.now() + 950,
  request: {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'hi' }],
  },
  response: {
    object: 'chat.completion',
    id: 'chatcmpl-1',
    model: 'gpt-4o-mini',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: 'hello' },
    }],
  },
});

if (converted.evalResult) {
  eval2otel.processEvaluation(converted.evalResult);
}
```

Supported adapter modes:

- `openai-chat`
- `openai-compatible`
- `anthropic`
- `cohere`
- `bedrock`
- `vertex`
- `ollama`

Every adapter result includes structured warnings and raw payload evidence
hashes, so conversion failures can be reported without dumping raw payloads.

## Framework Adapters

Promptfoo results can be converted directly into Eval2Otel results:

```ts
import {
  convertDeepEvalToEvalResults,
  convertPromptfooToEvalResults,
  convertRagasToEvalResults,
} from 'eval2otel';

const { evalResults, warnings } = convertPromptfooToEvalResults(promptfooJson, {
  runId: 'promptfoo-nightly',
  datasetId: 'support-evals',
  datasetVersion: '2026.05',
  defaultSystem: 'promptfoo',
});

for (const result of evalResults) {
  eval2otel.processEvaluation(result);
}

if (warnings.length > 0) {
  console.warn(warnings);
}
```

The adapter preserves Promptfoo success, score, assertion counts, failed
assertion warnings, metric names, run identity, case identity, and payload
hashes.

RAGAS and DeepEval exports use the same conversion shape:

```ts
const ragas = convertRagasToEvalResults(ragasJson, {
  runId: 'ragas-nightly',
  datasetId: 'rag-evals',
  defaultModel: 'gpt-4o-mini',
});

const deepeval = convertDeepEvalToEvalResults(deepevalJson, {
  runId: 'deepeval-nightly',
  includeExplanations: true,
  defaultModel: 'gpt-4o-mini',
});

for (const result of [...ragas.evalResults, ...deepeval.evalResults]) {
  eval2otel.processEvaluation(result);
}
```

RAGAS rows populate RAG metrics such as context precision, context recall,
answer relevance, and faithfulness. DeepEval rows preserve metric scores,
failed-metric warnings, expected-output fingerprints, and retrieval context as
RAG chunk evidence.

## RAG Telemetry

RAG payloads can include retrieval inputs, chunk metadata, explicit eval scores,
and derived ranking metrics:

```ts
const ragEval: EvalResult = {
  id: 'rag-case-1',
  timestamp: Date.now(),
  model: 'gpt-4o-mini',
  system: 'azure-openai',
  operation: 'chat',
  request: { model: 'gpt-4o-mini' },
  response: {},
  usage: {},
  performance: { duration: 1.1 },
  rag: {
    retrievalMethod: 'hybrid',
    dataSourceId: 'kb-prod',
    query: 'what shipped?',
    documentsRetrieved: 3,
    documentsUsed: 2,
    contextWindowTokens: 8192,
    contextTruncated: false,
    chunkSize: 512,
    overlapSize: 64,
    chunks: [
      {
        id: 'release-1',
        source: 'release-notes.md',
        relevanceScore: 0.92,
        position: 0,
        tokens: 220,
        used: true,
        citationId: 'cite-1',
      },
      {
        id: 'contract-1',
        source: 'contract.md',
        relevanceScore: 0.86,
        position: 1,
        tokens: 180,
      },
    ],
    metrics: {
      contextPrecision: 0.88,
      contextRecall: 0.91,
      answerRelevance: 0.93,
      faithfulness: 0.95,
    },
  },
};
```

Eval2Otel derives these when not provided explicitly:

- `gen_ai.rag.mean_reciprocal_rank`
- `gen_ai.rag.ndcg`
- `gen_ai.rag.citation_coverage`
- `gen_ai.rag.retrieval_used_ratio`
- `gen_ai.rag.top_k_relevance_mean`
- `gen_ai.rag.top_k_relevance_min`
- `gen_ai.rag.context_tokens_used`

The raw RAG query is hashed into `gen_ai.rag.query_sha256`; it is not emitted as
plain text.

## Semantic Convention Registry

The package exports a registry for attributes Eval2Otel owns, forwards, or
intentionally treats as compatible with OpenTelemetry GenAI and OpenLLMetry-style
RAG naming:

```ts
import {
  ATTRIBUTE_REGISTRY,
  assertRegisteredAttributes,
  collectUnknownAttributes,
  isRegisteredAttribute,
} from 'eval2otel';

assertRegisteredAttributes({
  'gen_ai.provider.name': 'openai',
  'evalops.contract.version': 'eval2otel.v1',
});
```

Use this in adapter tests to catch new attribute names before they ship. See
[docs/semconv-mapping.md](./docs/semconv-mapping.md) for the registry policy.

## Privacy And Safety Controls

Eval2Otel assumes captured content is sensitive:

- `captureContent` defaults to `false`
- `sampleContentRate` gates content capture when enabled
- `contentMaxLength` caps emitted text
- `markTruncatedContent` emits `gen_ai.message.content_truncated=true`
- `maxEventsPerSpan` caps high-cardinality event emission
- `redact`, `redactMessageContent`, and `redactToolArguments` can replace or remove content

If a redaction hook returns `null`, Eval2Otel omits the content and emits
`evalops.content_sha256` instead. If it returns a string, that string is emitted
and then capped by `contentMaxLength`.

```ts
const eval2otel = createEval2Otel({
  serviceName: 'eval-runner',
  captureContent: true,
  contentMaxLength: 4000,
  markTruncatedContent: true,
  redact: content => /sk-live-|BEGIN_PRIVATE_KEY/.test(content) ? null : content,
});
```

Adversarial fixtures for redaction and payload caps are documented in
[docs/security/adversarial-fixtures.md](./docs/security/adversarial-fixtures.md).

## CLI

Replay JSONL records into OTLP:

```bash
npx eval2otel-cli ingest \
  --file ./evals.jsonl \
  --service-name evalops-evals \
  --endpoint http://localhost:4318 \
  --protocol http/protobuf \
  --provider openai-chat \
  --content-cap 4000 \
  --redact-pattern "\\b\\d{16}\\b"
```

Useful flags:

- `--dry-run` validates and prints a summary without emitting telemetry
- `--provider <mode>` converts provider-native request/response JSONL
- `--provider-override <name>` forces `system` and `gen_ai.provider.name`
- `--autodetect-strict` fails unknown provider-native shapes instead of falling back
- `--with-exemplars` records active trace/span exemplars on metrics

Each provider-native line should look like:

```json
{"startTime":1725170000000,"endTime":1725170001200,"request":{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]},"response":{"id":"chatcmpl-1","object":"chat.completion","model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}]}}
```

## Python SDK Preview

The Python package mirrors the `eval2otel.v1` provenance, evidence, and
conversion-report vocabulary. It can run contract-only with no OpenTelemetry
dependency, or emit real spans when the optional OTel extras are installed:

```bash
pip install -e "python[otel,validation]"
PYTHONPATH=python python3 -m unittest discover -s python/tests
```

```python
from eval2otel import instrument_all

client = instrument_all()
report = client.process_evaluation({
    "id": "py-case-1",
    "model": "gpt-4o-mini",
    "system": "openai",
    "operation": "chat",
    "request": {"model": "gpt-4o-mini"},
    "response": {},
    "performance": {"duration": 0.5},
})

assert report.contract_version == "eval2otel.v1"
```

`instrument_all()` honors the common OTLP environment variables plus:

- `EVAL2OTEL_SERVICE_NAME`
- `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`
- `EVAL2OTEL_SAMPLE_RATE`
- `EVAL2OTEL_REDACT_PII`
- `EVAL2OTEL_PROVIDERS`

Provider hooks are optional. If provider packages and compatible
OpenLLMetry/OpenInference instrumentors are installed, Eval2Otel invokes them;
otherwise it returns structured handles explaining what was available.
The Python package also registers an `opentelemetry_instrumentor` entry point
named `eval2otel`, so `opentelemetry-instrument python main.py` can discover the
same `instrument_all()` path when the OTel instrumentation extra is installed.
Install the `validation` extra for optional Pydantic models in
`eval2otel.models`.

See [python/README.md](./python/README.md).

## Configuration

Common options:

- `serviceName`: required OpenTelemetry service name
- `serviceVersion`: optional service version
- `environment`: deployment environment attribute
- `endpoint`: OTLP endpoint
- `exporterProtocol`: `grpc`, `http/protobuf`, or `http/json`
- `exporterHeaders`: OTLP headers
- `tracesEndpoint`, `metricsEndpoint`, `logsEndpoint`: signal-specific endpoints
- `captureContent`, `sampleContentRate`, `contentMaxLength`: content controls
- `enableExemplars`: attach trace/span exemplars to metrics when active
- `metricAttributeAllowlist`, `maxMetricAttributes`: metric cardinality controls
- `semconvStabilityOptIn`, `semconvGaVersion`: pass-through semantic convention controls
- `useSdk=false`: no-SDK mode, using global OpenTelemetry APIs only
- `sdk`, `manageSdkLifecycle`: bring your own SDK and lifecycle handling

## Backend Setup

Eval2Otel works with any OTLP-compatible backend. For local development:

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest \
  --collector.otlp.enabled=true

export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

Then open `http://localhost:16686` and search for your configured
`serviceName`.

See [docs/backends.md](./docs/backends.md) for Grafana, Honeycomb, Datadog, New
Relic, Jaeger, and AWS X-Ray notes. Dashboard starters live in
[dashboards](./dashboards).

## Development

```bash
npm install
npm run lint
npm run build
npm test -- --coverage
npm audit --omit=dev
PYTHONPATH=python python3 -m unittest discover -s python/tests
```

The CI matrix runs lint, build, type-check, coverage, and package dry-run on
Node 18, 20, and 22.

## Examples

- [examples/basic-usage.ts](./examples/basic-usage.ts)
- [examples/tool-execution.ts](./examples/tool-execution.ts)
- [examples/agent-workflow.ts](./examples/agent-workflow.ts)
- [examples/helpers-convert.ts](./examples/helpers-convert.ts)
- [examples/provider-openai-chat.ts](./examples/provider-openai-chat.ts)
- [examples/provider-openai-compat.ts](./examples/provider-openai-compat.ts)
- [examples/provider-anthropic.ts](./examples/provider-anthropic.ts)
- [examples/provider-cohere.ts](./examples/provider-cohere.ts)
- [examples/provider-bedrock.ts](./examples/provider-bedrock.ts)
- [examples/provider-vertex.ts](./examples/provider-vertex.ts)
- [examples/provider-ollama.ts](./examples/provider-ollama.ts)
- [examples/ollama-integration.md](./examples/ollama-integration.md)

## Troubleshooting

- Unknown provider payload: pass `--provider <mode>` or use `--autodetect-strict`
- No content events: set `captureContent=true` and check sampling/redaction hooks
- Too many events: set `maxEventsPerSpan` and inspect `evalops.dropped_event_count`
- OTLP export mismatch: align `exporterProtocol` with your collector port and path
- Service name surprise: `OTEL_SERVICE_NAME` takes precedence over configured `serviceName`
- Semconv drift: assert adapter attributes with `assertRegisteredAttributes`

## License

MIT. See [LICENSE](./LICENSE).
