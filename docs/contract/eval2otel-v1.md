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

Any adapter or converter change that alters these outputs must update this
document and fixture expectations in the same pull request.
