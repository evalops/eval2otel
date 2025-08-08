export interface EvalResult {
  id: string;
  timestamp: number;
  model: string;
  system?: string;
  operation: 'chat' | 'text_completion' | 'embeddings' | 'execute_tool';
  
  // Request data
  request: {
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    seed?: number;
    choiceCount?: number;
  };
  
  // Response data
  response: {
    id?: string;
    model?: string;
    finishReasons?: string[];
    choices?: Array<{
      index: number;
      finishReason: string;
      message: {
        role: string;
        content?: string | Record<string, unknown>;
        toolCalls?: Array<{
          id: string;
          type: string;
          function: {
            name: string;
            arguments?: Record<string, unknown>;
          };
        }>;
      };
    }>;
  };
  
  // Usage metrics
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  
  // Performance metrics
  performance: {
    duration: number; // milliseconds
    timeToFirstToken?: number;
    timePerOutputToken?: number;
  };
  
  // Error information
  error?: {
    type: string;
    message: string;
  };
  
  // Conversation context
  conversation?: {
    id: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content?: string | Record<string, unknown>;
      toolCallId?: string;
      toolCalls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments?: Record<string, unknown>;
        };
      }>;
    }>;
  };
  
  // Tool execution data
  tool?: {
    name: string;
    description?: string;
    callId?: string;
    result?: Record<string, unknown>;
  };
}

export interface OtelConfig {
  serviceName: string;
  serviceVersion?: string;
  captureContent?: boolean; // Opt-in for sensitive data
  endpoint?: string;
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
  
  // Index signature to allow additional string attributes
  [key: string]: string | number | boolean | string[] | undefined;
}
