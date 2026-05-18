# Adversarial Fixture Guardrails

Eval2Otel conformance fixtures include adversarial privacy and cardinality cases
so adapter changes cannot silently leak content or overwhelm spans.

## Current Fixtures

- `chat-redaction.json`: verifies string redaction, provenance attributes, and
  redaction counters.
- `tool-provenance.json`: verifies tool argument truncation and adapter evidence
  attributes.
- `event-cap-rag.json`: verifies event caps and dropped-event counters for RAG
  metadata.
- `adversarial-redaction-null.json`: verifies prompt injection strings and
  secret-like tool arguments are removed, replaced with fingerprints, and kept
  out of event attributes.
- `adversarial-payload-cap.json`: verifies oversized content is capped,
  truncation is marked, and uncapped tails are not emitted.

## What These Prevent

- Secret-like values appearing in `gen_ai.message.content` or
  `gen_ai.tool.arguments`.
- Redaction hooks returning `null` without leaving a stable content fingerprint.
- Tool argument leakage through nested JSON serialization.
- Unbounded message or RAG chunk events on a single span.
- New expected fixture attributes bypassing the semantic convention registry.

## Adding A Fixture

1. Add a JSON fixture under `test/fixtures/conformance`.
2. Include `config`, `evalResult`, and `expected` sections.
3. Use `redactPattern` plus `redactMode: "null"` when the fixture should assert
   fingerprint-only output.
4. Add `forbiddenContent` on events for any string that must never appear.
5. Add `absentAttributes` for content attributes that must be omitted.
6. Run:

```bash
npm test -- --runTestsByPath test/conformance-contract.test.ts test/semconv.test.ts
```

The fixture should prove both the positive output shape and the negative leak
condition.
