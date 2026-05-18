import { ATTR } from './attributes';

export type AttributeSource = 'otel-genai' | 'openllmetry-compatible' | 'eval2otel-extension';

export interface AttributeSpec {
  key: string;
  source: AttributeSource;
  signal: 'span' | 'event' | 'metric' | 'all';
  stability: 'stable' | 'experimental' | 'extension';
  description: string;
}

export const ATTRIBUTE_REGISTRY: AttributeSpec[] = [
  { key: 'gen_ai.operation.name', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'GenAI operation name.' },
  { key: 'gen_ai.system', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'AI system or provider family.' },
  { key: 'error.type', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Error type for failed operations.' },
  { key: 'deployment.environment', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Deployment environment resource/context attribute.' },
  { key: ATTR.PROVIDER_NAME, source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Normalized provider name.' },
  { key: 'gen_ai.request.model', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Requested model name.' },
  { key: 'gen_ai.response.model', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Response model name.' },
  { key: 'gen_ai.request.temperature', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Sampling temperature.' },
  { key: 'gen_ai.request.max_tokens', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Requested maximum generated tokens.' },
  { key: 'gen_ai.request.top_p', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Top-p sampling value.' },
  { key: 'gen_ai.request.top_k', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Top-k sampling value.' },
  { key: 'gen_ai.request.frequency_penalty', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Frequency penalty.' },
  { key: 'gen_ai.request.presence_penalty', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Presence penalty.' },
  { key: 'gen_ai.request.stop_sequences', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Requested stop sequences.' },
  { key: 'gen_ai.request.seed', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Requested deterministic seed.' },
  { key: 'gen_ai.request.choice.count', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Requested choice count.' },
  { key: 'gen_ai.response.id', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Provider response id.' },
  { key: 'gen_ai.response.finish_reasons', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Response finish reasons.' },
  { key: 'gen_ai.usage.input_tokens', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Input token usage.' },
  { key: 'gen_ai.usage.output_tokens', source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Output token usage.' },
  { key: 'gen_ai.client.token.usage', source: 'otel-genai', signal: 'metric', stability: 'stable', description: 'Client token usage metric.' },
  { key: 'gen_ai.client.operation.duration', source: 'otel-genai', signal: 'metric', stability: 'stable', description: 'Client operation duration metric.' },
  { key: 'gen_ai.server.request.duration', source: 'otel-genai', signal: 'metric', stability: 'stable', description: 'Server request duration metric.' },
  { key: 'gen_ai.server.time_to_first_token', source: 'otel-genai', signal: 'metric', stability: 'stable', description: 'Time to first token metric.' },
  { key: 'gen_ai.server.time_per_output_token', source: 'otel-genai', signal: 'metric', stability: 'stable', description: 'Time per output token metric.' },
  { key: 'gen_ai.token.type', source: 'otel-genai', signal: 'metric', stability: 'stable', description: 'Token direction for token metrics.' },
  { key: 'gen_ai.conversation.id', source: 'otel-genai', signal: 'span', stability: 'experimental', description: 'Conversation id.' },
  { key: ATTR.MESSAGE_CONTENT, source: 'otel-genai', signal: 'event', stability: 'experimental', description: 'Captured message content.' },
  { key: ATTR.MESSAGE_CONTENT_JSON, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Captured structured message content.' },
  { key: ATTR.MESSAGE_CONTENT_TYPE, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Message content encoding.' },
  { key: ATTR.MESSAGE_ROLE, source: 'otel-genai', signal: 'event', stability: 'experimental', description: 'Message role.' },
  { key: ATTR.MESSAGE_INDEX, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Message index.' },
  { key: ATTR.MESSAGE_CONTENT_TRUNCATED, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Content truncation marker.' },
  { key: ATTR.RESPONSE_CHOICE_INDEX, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Choice index.' },
  { key: ATTR.RESPONSE_FINISH_REASON, source: 'otel-genai', signal: 'event', stability: 'experimental', description: 'Choice finish reason.' },
  { key: ATTR.TOOL_NAME, source: 'otel-genai', signal: 'all', stability: 'stable', description: 'Tool/function name.' },
  { key: 'gen_ai.tool.description', source: 'otel-genai', signal: 'span', stability: 'stable', description: 'Tool/function description.' },
  { key: ATTR.TOOL_CALL_ID, source: 'otel-genai', signal: 'event', stability: 'experimental', description: 'Tool call id.' },
  { key: ATTR.TOOL_ARGUMENTS, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Captured tool arguments.' },
  { key: ATTR.DATA_SOURCE_ID, source: 'otel-genai', signal: 'span', stability: 'experimental', description: 'RAG data source id.' },
  { key: 'gen_ai.rag.retrieval_method', source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Retrieval strategy.' },
  { key: 'gen_ai.rag.documents_retrieved', source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Number of retrieved documents.' },
  { key: 'gen_ai.rag.documents_used', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Number of retrieved documents used in generation.' },
  { key: 'gen_ai.rag.context_precision', source: 'openllmetry-compatible', signal: 'all', stability: 'extension', description: 'RAG context precision score.' },
  { key: 'gen_ai.rag.context_recall', source: 'openllmetry-compatible', signal: 'all', stability: 'extension', description: 'RAG context recall score.' },
  { key: 'gen_ai.rag.answer_relevance', source: 'openllmetry-compatible', signal: 'all', stability: 'extension', description: 'Answer relevance score.' },
  { key: 'gen_ai.rag.faithfulness', source: 'openllmetry-compatible', signal: 'all', stability: 'extension', description: 'Answer faithfulness score.' },
  { key: ATTR.RAG_QUERY_SHA256, source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Hash of retrieval query text.' },
  { key: ATTR.RAG_CONTEXT_WINDOW_TOKENS, source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Available context window tokens.' },
  { key: ATTR.RAG_CONTEXT_TOKENS_USED, source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Context tokens used by retrieved chunks.' },
  { key: ATTR.RAG_CONTEXT_TRUNCATED, source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Whether context was truncated.' },
  { key: ATTR.RAG_CHUNK_SIZE, source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Configured chunk size.' },
  { key: ATTR.RAG_OVERLAP_SIZE, source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Configured chunk overlap.' },
  { key: ATTR.RAG_MRR, source: 'openllmetry-compatible', signal: 'all', stability: 'extension', description: 'Mean reciprocal rank.' },
  { key: ATTR.RAG_NDCG, source: 'openllmetry-compatible', signal: 'all', stability: 'extension', description: 'Normalized discounted cumulative gain.' },
  { key: ATTR.RAG_CITATION_COVERAGE, source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Share of used chunks with citations.' },
  { key: ATTR.RAG_RETRIEVAL_USED_RATIO, source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Used versus retrieved document ratio.' },
  { key: ATTR.RAG_TOP_K_RELEVANCE_MEAN, source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Mean top-k relevance score.' },
  { key: ATTR.RAG_TOP_K_RELEVANCE_MIN, source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Minimum top-k relevance score.' },
  { key: 'gen_ai.rag.chunk.index', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Retrieved chunk index.' },
  { key: 'gen_ai.rag.chunk.id', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Retrieved chunk id.' },
  { key: 'gen_ai.rag.chunk.source', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Retrieved chunk source.' },
  { key: 'gen_ai.rag.chunk.relevance_score', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Retrieved chunk relevance score.' },
  { key: 'gen_ai.rag.chunk.position', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Retrieved chunk rank position.' },
  { key: 'gen_ai.rag.chunk.tokens', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Retrieved chunk token count.' },
  { key: ATTR.RAG_CHUNK_USED, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Whether the chunk was used.' },
  { key: ATTR.RAG_CHUNK_CITATION_ID, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Citation id associated with the chunk.' },
  { key: ATTR.RAG_CHUNK_EVIDENCE_SHA256, source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Chunk evidence hash.' },
  { key: 'gen_ai.agent.name', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Agent name.' },
  { key: 'gen_ai.agent.type', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Agent type.' },
  { key: 'gen_ai.agent.plan', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Agent plan.' },
  { key: 'gen_ai.agent.reasoning', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Agent reasoning.' },
  { key: 'gen_ai.agent.current_step', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Current agent step.' },
  { key: 'gen_ai.agent.total_steps', source: 'eval2otel-extension', signal: 'all', stability: 'extension', description: 'Total agent steps.' },
  { key: 'gen_ai.agent.step_duration', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Agent step duration metric.' },
  { key: 'gen_ai.agent.step.name', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Agent step metric name.' },
  { key: 'gen_ai.agent.step.status', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Agent step metric status.' },
  { key: 'gen_ai.agent.step.index', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Agent step index.' },
  { key: 'gen_ai.agent.step.type', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Agent step type.' },
  { key: 'gen_ai.agent.step.duration', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Agent step duration.' },
  { key: 'gen_ai.agent.step.error', source: 'eval2otel-extension', signal: 'event', stability: 'extension', description: 'Agent step error.' },
  { key: 'gen_ai.workflow.id', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Workflow id.' },
  { key: 'gen_ai.workflow.name', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Workflow name.' },
  { key: 'gen_ai.workflow.step', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Workflow step.' },
  { key: 'gen_ai.workflow.parent_id', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Parent workflow id.' },
  { key: 'gen_ai.safety.flagged', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Provider safety flagged marker.' },
  { key: 'gen_ai.safety.categories', source: 'eval2otel-extension', signal: 'span', stability: 'extension', description: 'Provider safety categories.' },
  { key: 'gen_ai.validation.success_rate', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Validation success rate metric.' },
  { key: 'gen_ai.validation.retry_count', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Validation retry count metric.' },
  { key: 'gen_ai.validation.duration', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Validation duration metric.' },
  { key: 'eval.metric.name', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Custom eval metric name.' },
  { key: 'eval.metric.type', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Custom eval metric type.' },
  { key: 'evalops.conversion.status', source: 'eval2otel-extension', signal: 'metric', stability: 'extension', description: 'Conversion outcome status.' },
  ...Object.values(ATTR)
    .filter(key => key.startsWith('evalops.'))
    .map(key => ({
      key,
      source: 'eval2otel-extension' as const,
      signal: 'all' as const,
      stability: 'extension' as const,
      description: 'Eval2Otel contract, privacy, provenance, or evidence attribute.',
    })),
];

const REGISTERED_KEYS = new Set(ATTRIBUTE_REGISTRY.map(spec => spec.key));

export function isRegisteredAttribute(key: string): boolean {
  if (REGISTERED_KEYS.has(key)) return true;
  if (key.startsWith('eval.')) return true;
  if (key.startsWith('gen_ai.safety.flagged.')) return true;
  if (key.startsWith('gen_ai.safety.severity.')) return true;
  if (/^(openai|azure\.openai|anthropic|cohere|aws\.bedrock|google\.vertex)\./.test(key)) return true;
  return false;
}

export function collectUnknownAttributes(attributes: Record<string, unknown>): string[] {
  return Object.keys(attributes)
    .filter(key => !isRegisteredAttribute(key))
    .sort();
}

export function assertRegisteredAttributes(attributes: Record<string, unknown>): void {
  const unknown = collectUnknownAttributes(attributes);
  if (unknown.length > 0) {
    throw new Error(`Unregistered eval2otel attributes: ${unknown.join(', ')}`);
  }
}
