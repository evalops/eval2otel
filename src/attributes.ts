// Centralized attribute keys to avoid typos and ease refactors
export const ATTR = {
  // Message-level
  MESSAGE_CONTENT: 'gen_ai.message.content',
  MESSAGE_CONTENT_JSON: 'gen_ai.message.content_json',
  MESSAGE_CONTENT_TYPE: 'gen_ai.message.content_type',
  MESSAGE_ROLE: 'gen_ai.message.role',
  MESSAGE_INDEX: 'gen_ai.message.index',
  MESSAGE_CONTENT_TRUNCATED: 'gen_ai.message.content_truncated',

  // Choice-level
  RESPONSE_CHOICE_INDEX: 'gen_ai.response.choice.index',
  RESPONSE_FINISH_REASON: 'gen_ai.response.finish_reason',

  // Tooling
  TOOL_NAME: 'gen_ai.tool.name',
  TOOL_CALL_ID: 'gen_ai.tool.call.id',
  TOOL_ARGUMENTS: 'gen_ai.tool.arguments',

  // Provider
  PROVIDER_NAME: 'gen_ai.provider.name',

  // RAG / data source
  DATA_SOURCE_ID: 'gen_ai.data_source.id',
  RAG_QUERY_SHA256: 'gen_ai.rag.query_sha256',
  RAG_CONTEXT_WINDOW_TOKENS: 'gen_ai.rag.context_window_tokens',
  RAG_CONTEXT_TOKENS_USED: 'gen_ai.rag.context_tokens_used',
  RAG_CONTEXT_TRUNCATED: 'gen_ai.rag.context_truncated',
  RAG_CHUNK_SIZE: 'gen_ai.rag.chunk_size',
  RAG_OVERLAP_SIZE: 'gen_ai.rag.overlap_size',
  RAG_MRR: 'gen_ai.rag.mean_reciprocal_rank',
  RAG_NDCG: 'gen_ai.rag.ndcg',
  RAG_CITATION_COVERAGE: 'gen_ai.rag.citation_coverage',
  RAG_RETRIEVAL_USED_RATIO: 'gen_ai.rag.retrieval_used_ratio',
  RAG_TOP_K_RELEVANCE_MEAN: 'gen_ai.rag.top_k_relevance_mean',
  RAG_TOP_K_RELEVANCE_MIN: 'gen_ai.rag.top_k_relevance_min',
  RAG_CHUNK_USED: 'gen_ai.rag.chunk.used',
  RAG_CHUNK_CITATION_ID: 'gen_ai.rag.chunk.citation_id',
  RAG_CHUNK_EVIDENCE_SHA256: 'gen_ai.rag.chunk.evidence_sha256',

  // Eval2Otel contract/evidence attributes
  CONTRACT_VERSION: 'evalops.contract.version',
  SEMCONV_VERSION: 'evalops.semconv.version',
  EVAL_ID: 'evalops.eval.id',
  SOURCE_FRAMEWORK: 'evalops.source.framework',
  RUN_ID: 'evalops.run.id',
  CASE_ID: 'evalops.case.id',
  DATASET_ID: 'evalops.dataset.id',
  DATASET_VERSION: 'evalops.dataset.version',
  ADAPTER_NAME: 'evalops.adapter.name',
  ADAPTER_VERSION: 'evalops.adapter.version',
  RAW_PAYLOAD_SHA256: 'evalops.raw_payload_sha256',
  PROMPT_SHA256: 'evalops.prompt_sha256',
  RESPONSE_SHA256: 'evalops.response_sha256',
  WARNING_COUNT: 'evalops.warning_count',
  DROPPED_EVENT_COUNT: 'evalops.dropped_event_count',
  REDACTED_CONTENT_COUNT: 'evalops.redacted_content_count',
  TRUNCATED_CONTENT_COUNT: 'evalops.truncated_content_count',

  // Privacy helpers
  CONTENT_SHA256: 'evalops.content_sha256',
} as const;

export type AttrKeys = typeof ATTR[keyof typeof ATTR];
