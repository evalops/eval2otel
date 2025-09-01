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
 * OpenAI native Chat Completions conversion (full shape incl. system_fingerprint, logprobs)
 */
export interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: string; content: string | null | Array<{ type: string; text?: string; image_url?: unknown }> }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  n?: number;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    logprobs?: unknown;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export function convertOpenAIChatToEval2Otel(
  request: OpenAIChatRequest,
  response: OpenAIChatResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `openai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const duration = (endTime - startTime) / 1000;
  // Extract multimodal text-only content for conversation messages
  const convMessages = request.messages?.map((m: any) => {
    if (Array.isArray(m.content)) {
      const text = m.content.filter((p:any)=>p?.type==='text').map((p:any)=>p.text).filter(Boolean).join('\n');
      return { role: m.role, content: text };
    }
    return m;
  });

  const hasImages = request.messages?.some((m:any)=>Array.isArray(m.content) && m.content.some((p:any)=>p?.type==='image_url')) || false;

  return {
    id: evalId,
    timestamp: startTime,
    model: response.model,
    system: 'openai',
    operation: response.choices.some(c => c.message.tool_calls && c.message.tool_calls.length > 0) ? 'execute_tool' : 'chat',
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
      choices: response.choices.map(c => ({
        index: c.index,
        finishReason: c.finish_reason,
        message: {
          role: c.message.role,
          content: c.message.content ?? '',
          toolCalls: c.message.tool_calls?.map(tc => ({ id: tc.id, type: tc.type, function: { name: tc.function.name, arguments: JSON.parse(tc.function.arguments) } })),
        },
      })),
    },
    usage: {
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    },
    performance: { duration },
    provider: {
      name: 'openai',
      attributes: {
        ...(response.system_fingerprint ? { 'openai.system_fingerprint': response.system_fingerprint } : {}),
        // Keep logprobs compact by storing only for the first choice if present
        ...(response.choices?.[0]?.logprobs ? { 'openai.choice0.logprobs': JSON.stringify(response.choices[0].logprobs) } : {}),
        ...(hasImages ? { 'openai.request.has_images': true } : {}),
      },
    },
    conversation: request.messages ? { id: options.conversationId ?? `conv-${evalId}`, messages: convMessages as any } : undefined,
  } as EvalResult;
}

/**
 * Anthropic Messages API conversion (simplified generic mapping)
 */
export interface AnthropicRequest {
  model: string;
  messages?: Array<{ role: string; content: Array<{ type: string; text?: string }>|string }>;
  temperature?: number; max_tokens?: number; top_p?: number; top_k?: number; stop_sequences?: string[]; seed?: number;
}
export interface AnthropicResponse {
  id: string;
  model: string;
  stop_reason?: string;
  content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; name: string; input: Record<string, unknown> }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  safety?: Record<string, unknown>;
}

export function convertAnthropicToEval2Otel(
  request: AnthropicRequest,
  response: AnthropicResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `anthropic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const duration = (endTime - startTime) / 1000;
  const hasToolUse = response.content.some(c => (c as any).type === 'tool_use');
  const textParts = response.content.filter((c: any) => c.type === 'text').map((c: any) => c.text);
  const toolCalls = response.content
    .filter((c: any) => c.type === 'tool_use')
    .map((t: any, i: number) => ({ id: `tool_${i}`, type: 'function', function: { name: t.name, arguments: t.input } }));

  // Normalize safety categories
  const safetyCats: string[] = [];
  const safetyAny: any = (response as any).safety;
  if (safetyAny) {
    if (Array.isArray(safetyAny.categories)) {
      safetyCats.push(...(safetyAny.categories as any[]).map(String));
    } else {
      for (const [k, v] of Object.entries<any>(safetyAny)) {
        if (k === 'categories') continue;
        const val = typeof v === 'object' ? (v?.flagged ?? v?.filtered ?? v?.blocked) : v;
        if (val) safetyCats.push(k);
      }
    }
  }

  return {
    id: evalId,
    timestamp: startTime,
    model: response.model,
    system: 'anthropic',
    operation: hasToolUse ? 'execute_tool' : 'chat',
    request: {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      topP: request.top_p,
      topK: request.top_k,
      stopSequences: request.stop_sequences,
      seed: request.seed,
      choiceCount: 1,
    },
    response: {
      id: response.id,
      model: response.model,
      finishReasons: [response.stop_reason ?? 'stop'],
      choices: [{ index: 0, finishReason: response.stop_reason ?? 'stop', message: { role: 'assistant', content: textParts.join('\n'), toolCalls } }],
    },
    usage: {
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      totalTokens: response.usage?.total_tokens,
    },
    performance: { duration },
    provider: {
      name: 'anthropic',
      attributes: {
        ...(response.stop_reason ? { 'anthropic.stop_reason': response.stop_reason } : {}),
        ...(response.safety ? { 'anthropic.safety': JSON.stringify(response.safety) } : {}),
        // Heuristic normalization
        ...(response.stop_reason === 'safety' ? { 'gen_ai.safety.flagged': true } : {}),
        ...(safetyCats.length ? { 'gen_ai.safety.categories': safetyCats } : {}),
      },
    },
    conversation: request.messages ? {
      id: options.conversationId ?? `conv-${evalId}`,
      messages: (request.messages as any[]).map((m: any) => ({ role: m.role, content: Array.isArray(m.content) ? (m.content.map((p:any)=>p.text).filter(Boolean).join('\n')) : m.content }))
    } : undefined,
  } as EvalResult;
}

/**
 * Cohere Chat conversion (simplified generic mapping)
 */
export interface CohereRequest {
  model: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number; max_tokens?: number; p?: number; k?: number; stop_sequences?: string[]; seed?: number;
}
export interface CohereResponse {
  id: string;
  model: string;
  text: string;
  finish_reason?: string;
  meta?: { billed_units?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };
  safety?: Record<string, unknown>;
}

export function convertCohereToEval2Otel(
  request: CohereRequest,
  response: CohereResponse,
  startTime: number,
  endTime: number,
  options: { evalId?: string; conversationId?: string } = {}
): EvalResult {
  const evalId = options.evalId ?? `cohere-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const duration = (endTime - startTime) / 1000;
  const billed = response.meta?.billed_units ?? {};
  // Normalize safety
  const chSafety: any = (response as any).safety;
  const chCats: string[] = Array.isArray(chSafety?.categories) ? chSafety.categories.map(String)
    : Array.isArray(chSafety?.flagged_categories) ? chSafety.flagged_categories.map(String)
    : Array.isArray(chSafety?.reasons) ? chSafety.reasons.map(String)
    : [];

  return {
    id: evalId,
    timestamp: startTime,
    model: response.model,
    system: 'cohere',
    operation: 'chat',
    request: {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      topP: request.p,
      topK: request.k,
      stopSequences: request.stop_sequences,
      seed: request.seed,
      choiceCount: 1,
    },
    response: {
      id: response.id,
      model: response.model,
      finishReasons: [response.finish_reason ?? 'stop'],
      choices: [{ index: 0, finishReason: response.finish_reason ?? 'stop', message: { role: 'assistant', content: response.text } }],
    },
    usage: {
      inputTokens: billed.input_tokens,
      outputTokens: billed.output_tokens,
      totalTokens: billed.total_tokens ?? ((billed.input_tokens ?? 0) + (billed.output_tokens ?? 0)),
    },
    performance: { duration },
    provider: {
      name: 'cohere',
      attributes: {
        ...(response.finish_reason ? { 'cohere.finish_reason': response.finish_reason } : {}),
        ...(response.safety ? { 'cohere.safety': JSON.stringify(response.safety) } : {}),
        ...(typeof (response as any).safety?.flagged === 'boolean' ? { 'gen_ai.safety.flagged': (response as any).safety.flagged } : {}),
        ...(chCats.length ? { 'gen_ai.safety.categories': chCats } : {}),
      },
    },
    conversation: request.messages ? { id: options.conversationId ?? `conv-${evalId}`, messages: request.messages as any } : undefined,
  } as EvalResult;
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
    provider: {
      name: 'aws.bedrock',
      attributes: {
        'aws.bedrock.stop_reason': response.stopReason ?? 'unknown',
        ...(response as any).guardrailTrace ? { 'aws.bedrock.guardrail.trace': JSON.stringify((response as any).guardrailTrace) } : {},
      },
    },
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
  // Normalize safety categories/flagged from prompt_filter_results if present
  let safetyFlagged: boolean | undefined;
  let safetyCategories: string[] | undefined;
  const pfr: any = (response as any).prompt_filter_results;
  if (Array.isArray(pfr)) {
    const cats = new Set<string>();
    let flagged = false;
    for (const item of pfr) {
      const cfr = item?.content_filter_results;
      if (cfr && typeof cfr === 'object') {
        for (const [k, v] of Object.entries<any>(cfr)) {
          const filtered = v?.filtered ?? v?.flagged ?? false;
          if (filtered) {
            flagged = true;
            cats.add(String(k));
          }
        }
      }
      if (item?.flagged === true) flagged = true;
      if (item?.category) cats.add(String(item.category));
    }
    safetyFlagged = flagged;
    safetyCategories = Array.from(cats);
  }

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
    provider: {
      name: 'azure.openai',
      attributes: {
        ...(pfr ? { 'azure.openai.prompt_filter_results': JSON.stringify(pfr) } : {}),
        ...(safetyFlagged !== undefined ? { 'gen_ai.safety.flagged': safetyFlagged } : {}),
        ...(safetyCategories && safetyCategories.length ? { 'gen_ai.safety.categories': safetyCategories } : {}),
      },
    },
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
  // Normalize safety
  const safetyRatings: any[] | undefined = (response as any).candidates?.[0]?.safetyRatings;
  const vertexCats: string[] = Array.isArray(safetyRatings) ? safetyRatings.map((r:any)=>String(r.category)).filter(Boolean) : [];
  let vertexFlagged: boolean | undefined;
  if (Array.isArray(safetyRatings)) {
    vertexFlagged = safetyRatings.some((r:any)=> r?.blocked === true || ['HIGH','VERY_HIGH'].includes(String(r?.probability || '').toUpperCase()));
  }

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
    provider: {
      name: 'google.vertex',
      attributes: {
        ...(safetyRatings ? { 'google.vertex.safety_ratings': JSON.stringify(safetyRatings) } : {}),
        ...(vertexFlagged !== undefined ? { 'gen_ai.safety.flagged': vertexFlagged } : {}),
        ...(vertexCats.length ? { 'gen_ai.safety.categories': vertexCats } : {}),
        ...(
          Array.isArray(safetyRatings)
            ? Object.fromEntries(
                (safetyRatings as any[])
                  .filter((r: any) => r?.category && r?.probability)
                  .map((r: any) => [
                    f"gen_ai.safety.severity.{str(r['category'])}",
                    str(r['probability']).upper(),
                  ])
              )
            : {}
        ),
      },
    },
    conversation: request.contents ? {
      id: options.conversationId ?? `conv-${evalId}`,
      messages: request.contents.map(m => ({ role: m.role as any, content: (m.parts.map(p => p.text).filter(Boolean).join('\n')) || '' })),
    } : undefined,
  } as EvalResult;
}
