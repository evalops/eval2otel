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