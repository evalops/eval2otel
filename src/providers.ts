import { EvalResult } from './types';

/**
 * Provider-specific utilities for converting AI system responses to eval2otel format
 */

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done_reason?: string;
  done: boolean;
  total_duration?: number; // nanoseconds
  load_duration?: number; // nanoseconds  
  prompt_eval_count?: number;
  prompt_eval_duration?: number; // nanoseconds
  eval_count?: number;
  eval_duration?: number; // nanoseconds
}

export interface OllamaRequest {
  model: string;
  messages?: Array<{
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  }>;
  prompt?: string; // For completion API
  temperature?: number;
  top_k?: number;
  top_p?: number;
  num_predict?: number; // max tokens
  stop?: string[];
  seed?: number;
}

export interface OllamaConversionOptions {
  /** Unique evaluation ID */
  evalId?: string;
  /** Conversation ID for grouping messages */
  conversationId?: string;
  /** Full conversation context */
  conversationMessages?: Array<{
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  }>;
  /** Tool execution details (if applicable) */
  toolExecution?: {
    name: string;
    description?: string;
    callId?: string;
    result?: Record<string, unknown>;
  };
}

/**
 * Convert Ollama API response to eval2otel format
 */
export function convertOllamaToEval2Otel(
  request: OllamaRequest,
  response: OllamaResponse,
  startTime: number,
  options: OllamaConversionOptions = {}
): EvalResult {
  const evalId = options.evalId ?? `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = startTime;
  
  // Calculate performance metrics (convert nanoseconds to seconds)
  const totalDurationSec = response.total_duration ? response.total_duration / 1e9 : 0;
  const evalDurationSec = response.eval_duration ? response.eval_duration / 1e9 : 0;
  const timeToFirstToken = response.load_duration ? response.load_duration / 1e9 : undefined;
  const timePerOutputToken = response.eval_count && evalDurationSec ? 
    evalDurationSec / response.eval_count : undefined;

  // Determine operation type
  const hasToolCalls = response.message.tool_calls && response.message.tool_calls.length > 0;
  const operation = hasToolCalls ? 'execute_tool' : 'chat';

  // Build response choices
  const choices = [{
    index: 0,
    finishReason: response.done_reason ?? (response.done ? 'stop' : 'length'),
    message: {
      role: response.message.role,
      content: response.message.content ?? '',
      toolCalls: response.message.tool_calls?.map((call, idx) => ({
        id: `call_${idx}`,
        type: 'function',
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      })),
    },
  }];

  const evalResult: EvalResult = {
    id: evalId,
    timestamp,
    model: response.model,
    system: 'ollama',
    operation: operation as EvalResult['operation'],
    
    request: {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.num_predict,
      topK: request.top_k,
      topP: request.top_p,
      stopSequences: request.stop,
      seed: request.seed,
      choiceCount: 1,
    },
    
    response: {
      id: `ollama-${timestamp}`,
      model: response.model,
      finishReasons: [response.done_reason ?? 'stop'],
      choices,
    },
    
    usage: {
      inputTokens: response.prompt_eval_count,
      outputTokens: response.eval_count,
      totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    },
    
    performance: {
      duration: totalDurationSec,
      timeToFirstToken,
      timePerOutputToken,
    },
  };

  // Add conversation context if provided
  if (options.conversationMessages) {
    evalResult.conversation = {
      id: options.conversationId ?? `conv-${evalId}`,
      messages: options.conversationMessages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
        content: msg.content,
        toolCalls: msg.tool_calls?.map((call, idx) => ({
          id: `call_${idx}`,
          type: 'function',
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        })),
      })),
    };
  }

  // Add tool execution details if provided
  if (options.toolExecution && hasToolCalls) {
    evalResult.tool = {
      name: options.toolExecution.name,
      description: options.toolExecution.description,
      callId: options.toolExecution.callId,
      result: options.toolExecution.result,
    };
  }

  return evalResult;
}

/**
 * Convert OpenAI-compatible response to eval2otel format
 * (Ollama supports OpenAI-compatible endpoints)
 */
export interface OpenAICompatibleResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAICompatibleRequest {
  model: string;
  messages?: Array<{ role: string; content: string | null }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  n?: number;
}

export function convertOpenAICompatibleToEval2Otel(
  request: OpenAICompatibleRequest,
  response: OpenAICompatibleResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string; system?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `openai-compat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const duration = (endTime - startTime) / 1000; // Convert to seconds
  
  const hasToolCalls = response.choices.some(choice => 
    choice.message.tool_calls && choice.message.tool_calls.length > 0
  );
  
  return {
    id: evalId,
    timestamp: startTime,
    model: response.model,
    system: options.system ?? 'openai-compatible',
    operation: hasToolCalls ? 'execute_tool' : 'chat',
    
    request: {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      topP: request.top_p,
      frequencyPenalty: request.frequency_penalty,
      presencePenalty: request.presence_penalty,
      stopSequences: request.stop,
      seed: request.seed,
      choiceCount: request.n ?? 1,
    },
    
    response: {
      id: response.id,
      model: response.model,
      finishReasons: response.choices.map(choice => choice.finish_reason),
      choices: response.choices.map(choice => ({
        index: choice.index,
        finishReason: choice.finish_reason,
        message: {
          role: choice.message.role,
          content: choice.message.content ?? '',
          toolCalls: choice.message.tool_calls?.map(call => ({
            id: call.id,
            type: call.type,
            function: {
              name: call.function.name,
              arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
            },
          })),
        },
      })),
    },
    
    usage: {
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    },
    
    performance: {
      duration,
    },
  };
}

/**
 * AWS Bedrock generic conversion (for simple text/chat invocations)
 * Note: Bedrock has provider-specific shapes; this handles common fields.
 */
export interface BedrockRequest {
  modelId: string;
  inputText?: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number; top_p?: number; top_k?: number; maxTokens?: number; stopSequences?: string[]; seed?: number;
}
export interface BedrockResponse {
  modelId: string;
  outputText?: string;
  messages?: Array<{ role: string; content: string }>;
  stopReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}
export function convertBedrockToEval2Otel(
  request: BedrockRequest,
  response: BedrockResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `bedrock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const duration = (endTime - startTime) / 1000;
  const content = response.outputText ?? '';
  return {
    id: evalId,
    timestamp: startTime,
    model: response.modelId,
    system: 'aws.bedrock',
    operation: 'chat',
    request: {
      model: request.modelId,
      temperature: request.temperature,
      topP: request.top_p,
      topK: request.top_k,
      maxTokens: request.maxTokens,
      stopSequences: request.stopSequences,
      seed: request.seed,
      choiceCount: 1,
    },
    response: {
      id: `${response.modelId}-${startTime}`,
      model: response.modelId,
      finishReasons: [response.stopReason ?? 'stop'],
      choices: [{ index: 0, finishReason: response.stopReason ?? 'stop', message: { role: 'assistant', content } }],
    },
    usage: {
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
      totalTokens: response.usage?.totalTokens ?? ((response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0)),
    },
    performance: { duration },
    conversation: request.messages ? { id: options.conversationId ?? `conv-${evalId}`, messages: request.messages as any } : undefined,
  } as EvalResult;
}

/**
 * Azure OpenAI conversion (OpenAI-like payloads with Azure wrapper)
 */
export interface AzureOpenAIRequest {
  model: string;
  messages?: Array<{ role: string; content: string | null }>;
  temperature?: number; max_tokens?: number; top_p?: number; frequency_penalty?: number; presence_penalty?: number; stop?: string[]; seed?: number; n?: number;
}
export interface AzureOpenAIResponse { 
  id: string; created: number; model: string;
  choices: Array<{ index: number; finish_reason: string; message: { role: string; content: string | null } }>; 
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}
export function convertAzureOpenAIToEval2Otel(
  request: AzureOpenAIRequest,
  response: AzureOpenAIResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `azure-openai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const duration = (endTime - startTime) / 1000;
  return {
    id: evalId,
    timestamp: startTime,
    model: response.model,
    system: 'azure.openai',
    operation: 'chat',
    request: {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      topP: request.top_p,
      frequencyPenalty: request.frequency_penalty,
      presencePenalty: request.presence_penalty,
      stopSequences: request.stop,
      seed: request.seed,
      choiceCount: request.n ?? 1,
    },
    response: {
      id: response.id,
      model: response.model,
      finishReasons: response.choices.map(c => c.finish_reason),
      choices: response.choices.map(c => ({ index: c.index, finishReason: c.finish_reason, message: { role: c.message.role, content: c.message.content ?? '' } })),
    },
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
    performance: { duration },
    conversation: request.messages ? { id: options.conversationId ?? `conv-${evalId}`, messages: request.messages as any } : undefined,
  } as EvalResult;
}

/**
 * Google Vertex AI (Gemini) generic conversion
 */
export interface VertexRequest {
  model: string;
  contents?: Array<{ role: string; parts: Array<{ text?: string }> }>;
  temperature?: number; topP?: number; topK?: number; maxOutputTokens?: number; stopSequences?: string[]; seed?: number;
}
export interface VertexResponse {
  model: string;
  candidates: Array<{ index?: number; finishReason?: string; content: { role: string; parts: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}
export function convertVertexToEval2Otel(
  request: VertexRequest,
  response: VertexResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `vertex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const duration = (endTime - startTime) / 1000;
  const choices = response.candidates.map((c, i) => ({
    index: c.index ?? i,
    finishReason: c.finishReason ?? 'stop',
    message: {
      role: c.content.role,
      content: (c.content.parts.map(p => p.text).filter(Boolean).join('\n')) || '',
    },
  }));
  return {
    id: evalId,
    timestamp: startTime,
    model: response.model,
    system: 'google.vertex',
    operation: 'chat',
    request: {
      model: request.model,
      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,
      maxTokens: request.maxOutputTokens,
      stopSequences: request.stopSequences,
      seed: request.seed,
      choiceCount: choices.length,
    },
    response: {
      id: `${response.model}-${startTime}`,
      model: response.model,
      finishReasons: choices.map(c => c.finishReason),
      choices,
    },
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      totalTokens: response.usageMetadata?.totalTokenCount,
    },
    performance: { duration },
    conversation: request.contents ? {
      id: options.conversationId ?? `conv-${evalId}`,
      messages: request.contents.map(m => ({ role: m.role as any, content: (m.parts.map(p => p.text).filter(Boolean).join('\n')) || '' })),
    } : undefined,
  } as EvalResult;
}
