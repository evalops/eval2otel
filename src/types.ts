import { Span, SpanContext } from '@opentelemetry/api';
import { z } from 'zod';

// Zod schema for runtime validation
export const EvalResultSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  model: z.string(),
  system: z.string().optional(),
  operation: z.enum(['chat', 'text_completion', 'embeddings', 'execute_tool', 'agent_execution', 'workflow_step']),
  
  // Request data
  request: z.object({
    model: z.string(),
    temperature: z.number().optional(),
    maxTokens: z.number().positive().optional(),
    topP: z.number().optional(),
    topK: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    stopSequences: z.array(z.string()).optional(),
    seed: z.number().optional(),
    choiceCount: z.number().positive().optional(),
  }),
  
  // Response data
  response: z.object({
    id: z.string().optional(),
    model: z.string().optional(),
    finishReasons: z.array(z.string()).optional(),
    choices: z.array(z.object({
      index: z.number(),
      finishReason: z.string(),
      message: z.object({
        role: z.string(),
        content: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
        toolCalls: z.array(z.object({
          id: z.string(),
          type: z.string(),
          function: z.object({
            name: z.string(),
            arguments: z.record(z.string(), z.unknown()).optional(),
          }),
        })).optional(),
      }),
    })).optional(),
  }),
  
  // Usage metrics
  usage: z.object({
    inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    totalTokens: z.number().nonnegative().optional(),
  }),
  
  // Performance metrics (duration in seconds, per OTel spec)
  performance: z.object({
    duration: z.number().positive(), // seconds
    timeToFirstToken: z.number().positive().optional(), // seconds
    timePerOutputToken: z.number().positive().optional(), // seconds per token
  }),
  
  // Error information
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
  
  // Conversation context
  conversation: z.object({
    id: z.string(),
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant', 'tool']),
      content: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
      toolCallId: z.string().optional(),
      toolCalls: z.array(z.object({
        id: z.string(),
        type: z.string(),
        function: z.object({
          name: z.string(),
          arguments: z.record(z.string(), z.unknown()).optional(),
        }),
      })).optional(),
    })),
  }).optional(),
  
  // Tool execution data
  tool: z.object({
    name: z.string(),
    description: z.string().optional(),
    callId: z.string().optional(),
    result: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  
  // Agent execution data
  agent: z.object({
    name: z.string(),
    type: z.enum(['orchestrator', 'executor', 'planner', 'retriever', 'evaluator']).optional(),
    plan: z.string().optional(),
    reasoning: z.string().optional(),
    steps: z.array(z.object({
      name: z.string(),
      type: z.string().optional(),
      status: z.enum(['pending', 'running', 'completed', 'failed']),
      duration: z.number().optional(), // milliseconds
      error: z.string().optional(),
    })).optional(),
  }).optional(),
  
  // Workflow data
  workflow: z.object({
    id: z.string(),
    name: z.string().optional(),
    step: z.string().optional(),
    totalSteps: z.number().optional(),
    parentWorkflowId: z.string().optional(),
    state: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  
  // RAG-specific data
  rag: z.object({
    retrievalMethod: z.enum(['vector_search', 'keyword', 'hybrid']).optional(),
    documentsRetrieved: z.number().optional(),
    documentsUsed: z.number().optional(),
    chunks: z.array(z.object({
      id: z.string(),
      source: z.string(),
      relevanceScore: z.number(),
      position: z.number(),
      tokens: z.number().optional(),
    })).optional(),
    metrics: z.object({
      contextPrecision: z.number().optional(),
      contextRecall: z.number().optional(),
      answerRelevance: z.number().optional(),
      faithfulness: z.number().optional(),
    }).optional(),
  }).optional(),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;

export interface OtelConfig {
  /** Service name for OpenTelemetry */
  serviceName: string;
  
  /** Service version */
  serviceVersion?: string;
  
  /** Deployment environment (prod, staging, dev) */
  environment?: string;
  
  /** Whether to capture message content in spans (default: false for privacy) */
  captureContent?: boolean;
  
  /** Rate of content sampling (0.0 to 1.0, default: 1.0) */
  sampleContentRate?: number;
  
  /** Optional maximum length for captured content (characters). If unset, no truncation. */
  contentMaxLength?: number;
  
  /** Optional sampler to decide if content should be captured for a given evaluation. */
  contentSampler?: (evalResult: EvalResult) => boolean;

  /** Whether to emit operational metadata events (conversation, choices, agent, RAG). Default: true */
  emitOperationalMetadata?: boolean;
  
  /** Redaction function for sensitive content */
  redact?: (content: string) => string | null;
  
  /** Optional redaction hook for message content with role context */
  redactMessageContent?: (content: string, info: { role: string }) => string | null;

  /** Optional redaction hook for tool arguments with function context */
  redactToolArguments?: (argsJson: string, info: { functionName: string; callId?: string }) => string | null;
  
  /** OTLP endpoint */
  endpoint?: string;
  
  /** Custom resource attributes */
  resourceAttributes?: Record<string, string | number | boolean>;
}

export interface ProcessOptions {
  /** Additional metrics to record */
  metrics?: Record<string, number>;
  
  /** Parent span for context linking */
  parentSpan?: Span | SpanContext;
  
  /** Additional attributes for this evaluation */
  attributes?: Record<string, string | number | boolean>;
}

export interface GenAIAttributes {
  // Required
  'gen_ai.operation.name': string;
  'gen_ai.system': string;
  
  // Conditionally required
  'error.type'?: string;
  'gen_ai.conversation.id'?: string;
  'gen_ai.output.type'?: string;
  'gen_ai.request.choice.count'?: number;
  'gen_ai.request.model'?: string;
  'gen_ai.request.seed'?: number;
  'server.port'?: number;
  
  // Recommended
  'gen_ai.request.frequency_penalty'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.request.presence_penalty'?: number;
  'gen_ai.request.stop_sequences'?: string[];
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.top_k'?: number;
  'gen_ai.request.top_p'?: number;
  'gen_ai.response.finish_reasons'?: string[];
  'gen_ai.response.id'?: string;
  'gen_ai.response.model'?: string;
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'server.address'?: string;
  
  // Tool specific
  'gen_ai.tool.call.id'?: string;
  'gen_ai.tool.description'?: string;
  'gen_ai.tool.name'?: string;
  
  // Agent specific
  'gen_ai.agent.name'?: string;
  'gen_ai.agent.type'?: string;
  'gen_ai.agent.plan'?: string;
  'gen_ai.agent.reasoning'?: string;
  'gen_ai.agent.current_step'?: string;
  'gen_ai.agent.total_steps'?: number;
  
  // Workflow specific
  'gen_ai.workflow.id'?: string;
  'gen_ai.workflow.name'?: string;
  'gen_ai.workflow.step'?: string;
  'gen_ai.workflow.parent_id'?: string;
  
  // RAG specific
  'gen_ai.rag.retrieval_method'?: string;
  'gen_ai.rag.documents_retrieved'?: number;
  'gen_ai.rag.documents_used'?: number;
  'gen_ai.rag.context_precision'?: number;
  'gen_ai.rag.context_recall'?: number;
  'gen_ai.rag.answer_relevance'?: number;
  'gen_ai.rag.faithfulness'?: number;
  
  // Index signature to allow additional string attributes
  [key: string]: string | number | boolean | string[] | undefined;
}
