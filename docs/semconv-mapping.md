# Semantic Convention Mapping

Eval2Otel follows OpenTelemetry GenAI semantic conventions first and keeps a
small explicit registry for attributes that are not yet stable upstream or are
Eval2Otel-specific.

## Sources

Each registry entry has a source:

- `otel-genai`: an OpenTelemetry GenAI or closely related OpenTelemetry
  attribute/metric name.
- `openllmetry-compatible`: a RAG quality name that follows common OpenLLMetry
  style and should stay easy to query across LLM observability tools.
- `eval2otel-extension`: an Eval2Otel-owned field for contract, provenance,
  evidence, privacy, framework, or provider-adapter behavior.

## Policy

- Prefer stable OpenTelemetry GenAI names when they exist.
- Use `evalops.*` for Eval2Otel contract and evidence fields.
- Use `eval.*` for framework-level evaluation attributes.
- Use provider prefixes such as `openai.*`, `anthropic.*`, `cohere.*`,
  `aws.bedrock.*`, and `google.vertex.*` only for provider-native diagnostics.
- Do not emit raw RAG queries or prompt content as attributes. Hash them or put
  them behind opt-in content events.
- Add tests with `assertRegisteredAttributes` whenever a converter emits a new
  attribute.

## RAG Names

Eval2Otel currently emits these RAG attributes:

- `gen_ai.data_source.id`
- `gen_ai.rag.retrieval_method`
- `gen_ai.rag.documents_retrieved`
- `gen_ai.rag.documents_used`
- `gen_ai.rag.context_precision`
- `gen_ai.rag.context_recall`
- `gen_ai.rag.answer_relevance`
- `gen_ai.rag.faithfulness`
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

Chunk events may add:

- `gen_ai.rag.chunk.index`
- `gen_ai.rag.chunk.id`
- `gen_ai.rag.chunk.source`
- `gen_ai.rag.chunk.relevance_score`
- `gen_ai.rag.chunk.position`
- `gen_ai.rag.chunk.tokens`
- `gen_ai.rag.chunk.used`
- `gen_ai.rag.chunk.citation_id`
- `gen_ai.rag.chunk.evidence_sha256`

## Adapter Test Pattern

```ts
import { assertRegisteredAttributes } from 'eval2otel';

assertRegisteredAttributes({
  'gen_ai.provider.name': 'openai',
  'evalops.contract.version': 'eval2otel.v1',
  'eval.promptfoo.score': 0.9,
});
```

If this throws, either move the attribute into an allowed namespace or add it to
`src/semconv.ts` with a source, signal, stability, and description.
