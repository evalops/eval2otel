# Eval2Otel V1 Telemetry Contract

`eval2otel.v1` is the public compatibility contract for converting AI evaluation
results into OpenTelemetry GenAI telemetry. New providers and framework adapters
must preserve this shape unless they introduce a new contract version.

## Required Span Shape

Every converted evaluation creates one client span named by operation:

| Eval operation | Span name |
| --- | --- |
| `chat`, `text_completion` | `gen_ai.chat` |
| `embeddings` | `gen_ai.embeddings` |
| `execute_tool` | `gen_ai.execute_tool` |
| `agent_execution` | `gen_ai.agent` |
| `workflow_step` | `gen_ai.workflow` |

Every span must include:

- `gen_ai.operation.name`
- `gen_ai.system`
- `evalops.contract.version`
- `evalops.semconv.version`
- `evalops.eval.id`
- `evalops.warning_count`
- `evalops.dropped_event_count`
- `evalops.redacted_content_count`
- `evalops.truncated_content_count`

Provider-aware conversions should include `gen_ai.provider.name` using the
normalized provider names exported by `normalizeProviderName`.

## Attribute Registry

Eval2Otel exports `ATTRIBUTE_REGISTRY`, `isRegisteredAttribute`,
`collectUnknownAttributes`, and `assertRegisteredAttributes` from the root
entrypoint. New adapters should use these helpers in tests to keep emitted
attributes intentionally aligned with:

- OpenTelemetry GenAI semantic convention attributes;
- OpenLLMetry-compatible RAG quality names where no stable OTel equivalent
  exists yet;
- Eval2Otel-owned `evalops.*` contract, privacy, provenance, and evidence
  attributes;
- framework-specific `eval.*` diagnostic attributes;
- provider-prefixed diagnostic attributes such as `openai.*`,
  `anthropic.*`, and `google.vertex.*`.

New unregistered attributes must either be added to the registry with source and
stability metadata or moved into an existing provider/custom namespace.

## Provenance And Evidence

The optional `EvalResult.provenance` and `EvalResult.evidence` fields are for
audit metadata, not prompt text. When present, they are emitted as namespaced
attributes:

- `evalops.source.framework`
- `evalops.run.id`
- `evalops.case.id`
- `evalops.dataset.id`
- `evalops.dataset.version`
- `evalops.adapter.name`
- `evalops.adapter.version`
- `evalops.raw_payload_sha256`
- `evalops.prompt_sha256`
- `evalops.response_sha256`

Adapters should hash raw provider/framework payloads before emitting them. The
hash gives operators a stable join key without copying customer content into
normal telemetry.

## Privacy Guardrails

Content capture remains opt-in through `captureContent`. When content capture is
enabled:

- redacted or changed content increments `evalops.redacted_content_count`;
- truncated message or tool content increments `evalops.truncated_content_count`;
- content redacted to `null` is replaced by `evalops.content_sha256`;
- event caps increment `evalops.dropped_event_count`.

These counters are part of the contract so dashboards and CI can detect privacy
or cardinality regressions.

The adversarial fixtures include redaction-to-fingerprint and oversized payload
cases. They are intended to catch prompt injection strings, secret-like values,
tool argument leakage, and content cap regressions before adapter changes merge.

## RAG Contract Additions

RAG telemetry may include retrieval inputs and derived ranking metrics:

- `gen_ai.data_source.id`
- `gen_ai.rag.query_sha256`
- `gen_ai.rag.context_window_tokens`
- `gen_ai.rag.context_tokens_used`
- `gen_ai.rag.context_truncated`
- `gen_ai.rag.chunk_size`
- `gen_ai.rag.overlap_size`
- `gen_ai.rag.mean_reciprocal_rank`
- `gen_ai.rag.ndcg`
- `gen_ai.rag.citation_coverage`
- `gen_ai.rag.retrieval_used_ratio`
- `gen_ai.rag.top_k_relevance_mean`
- `gen_ai.rag.top_k_relevance_min`

The raw retrieval query is not emitted. Adapters provide it as `rag.query` and
Eval2Otel emits only the SHA-256 fingerprint.

RAG chunk events may include:

- `gen_ai.rag.chunk.used`
- `gen_ai.rag.chunk.citation_id`
- `gen_ai.rag.chunk.evidence_sha256`

If explicit RAG metric values are present in `EvalResult.rag.metrics`, they win.
Otherwise Eval2Otel derives values from the chunk list when enough information is
available.

## Framework And Provider Adapter Contract

Framework adapters should populate `provenance.sourceFramework`,
`provenance.adapter`, `provenance.adapterVersion`, and evidence hashes.

Provider-native adapters should return a `ProviderConversionResult` with:

- `mode`;
- `confidence`;
- `evalResult`, or `null` on failure;
- structured warnings;
- evidence containing at least `rawPayloadSha256`.

Framework adapters additionally emit namespaced `eval.*` attributes:

- Promptfoo: `eval.promptfoo.*` for pass state, score, assertion counts, failed
  assertion counts, and metric names.
- RAGAS: `eval.ragas.*` for source metric values, metric names, and reference
  fingerprints. Shared RAG quality fields are also copied into
  `EvalResult.rag.metrics`.
- DeepEval: `eval.deepeval.*` for pass state, failed metric counts, normalized
  metric scores, metric names, and expected-output fingerprints.

## Operational Telemetry

`Eval2Otel.processEvaluation` records eval2otel self-telemetry:

- `eval2otel.conversion.count`
- `eval2otel.conversion.duration`
- `eval2otel.conversion.warning_count`
- `eval2otel.conversion.dropped_event_count`
- `eval2otel.conversion.redacted_content_count`
- `eval2otel.conversion.truncated_content_count`

Consumers can use these metrics as SLO gates for adapter quality and privacy
behavior.

## Conformance Fixtures

The fixture suite in `test/fixtures/conformance` is the executable form of this
contract. Each fixture asserts:

- span name;
- contract, semantic convention, provider, and provenance attributes;
- emitted event order and event attributes;
- redaction, truncation, warning, and dropped-event counters.
- semconv registry coverage for every expected fixture attribute.

Any adapter or converter change that alters these outputs must update this
document and fixture expectations in the same pull request.
