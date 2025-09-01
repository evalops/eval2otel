import { 
  convertBedrockToEval2Otel,
  convertAzureOpenAIToEval2Otel,
  convertVertexToEval2Otel,
  convertOpenAICompatibleToEval2Otel,
  convertOllamaToEval2Otel,
  type OpenAICompatibleResponse,
  type OpenAICompatibleRequest,
  type OllamaRequest,
  type OllamaResponse,
} from '../src/providers';

describe('Provider converters', () => {
  it('converts Bedrock payloads', () => {
    const start = Date.now();
    const end = start + 500;
    const evalRes = convertBedrockToEval2Otel(
      { modelId: 'anthropic.claude-3', inputText: 'hi' },
      { modelId: 'anthropic.claude-3', outputText: 'hello', stopReason: 'end_turn', usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 } },
      start,
      end,
    );
    expect(evalRes.system).toBe('aws.bedrock');
    expect(evalRes.operation).toBe('chat');
    expect(evalRes.response!.choices![0].message.content).toBe('hello');
    expect(evalRes.usage.totalTokens).toBe(8);
    expect(evalRes.performance.duration).toBeCloseTo(0.5, 3);
  });

  it('converts Azure OpenAI payloads', () => {
    const start = Date.now();
    const end = start + 1000;
    const evalRes = convertAzureOpenAIToEval2Otel(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      { id: 'id1', created: Math.floor(start/1000), model: 'gpt-4o', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }], usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 } },
      start,
      end,
    );
    expect(evalRes.system).toBe('azure.openai');
    expect(evalRes.response!.id).toBe('id1');
    expect(evalRes.response!.finishReasons).toEqual(['stop']);
    expect(evalRes.usage.totalTokens).toBe(6);
  });

  it('converts Vertex AI payloads', () => {
    const start = Date.now();
    const end = start + 200;
    const evalRes = convertVertexToEval2Otel(
      { model: 'gemini-1.5', contents: [{ role: 'user', parts: [{ text: 'ping' }] }] },
      { model: 'gemini-1.5', candidates: [{ content: { role: 'assistant', parts: [{ text: 'pong' }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 } },
      start,
      end,
    );
    expect(evalRes.system).toBe('google.vertex');
    expect(evalRes.response!.choices![0].message.content).toBe('pong');
    expect(evalRes.usage.totalTokens).toBe(3);
    expect(evalRes.performance.duration).toBeCloseTo(0.2, 3);
  });

  it('converts OpenAI-compatible payloads including tool calls', () => {
    const start = Date.now();
    const end = start + 300;
    const request: OpenAICompatibleRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      n: 1,
    } as any;
    const response: OpenAICompatibleResponse = {
      id: 'chatcmpl-1', object: 'chat.completion', created: Math.floor(start/1000), model: 'gpt-4o',
      choices: [{
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: 'ok', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'f', arguments: '{"x":1}' } }] },
      }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    } as any;
    const evalRes = convertOpenAICompatibleToEval2Otel(request, response, start, end, { system: 'openai' });
    expect(evalRes.system).toBe('openai');
    expect(evalRes.response!.choices![0].message.toolCalls![0].function.name).toBe('f');
    expect(evalRes.usage.totalTokens).toBe(5);
    expect(evalRes.performance.duration).toBeCloseTo(0.3, 3);
  });

  it('converts Ollama native payloads with durations', () => {
    const start = Date.now();
    const req: OllamaRequest = { model: 'llama3', temperature: 0.5 } as any;
    const res: OllamaResponse = {
      model: 'llama3', created_at: new Date(start).toISOString(), done: true, done_reason: 'stop',
      message: { role: 'assistant', content: 'yo' },
      total_duration: 1_000_000_000, // 1s
      load_duration: 100_000_000, // 0.1s
      eval_count: 10,
      eval_duration: 500_000_000, // 0.5s
      prompt_eval_count: 5,
    } as any;
    const evalRes = convertOllamaToEval2Otel(req, res, start);
    expect(evalRes.system).toBe('ollama');
    expect(evalRes.performance.duration).toBeCloseTo(1.0, 3);
    expect(evalRes.performance.timeToFirstToken).toBeCloseTo(0.1, 3);
    expect(evalRes.performance.timePerOutputToken).toBeCloseTo(0.05, 3);
  });

  it('converts Ollama with tool calls as execute_tool', () => {
    const start = Date.now();
    const req: OllamaRequest = { model: 'llama3' } as any;
    const res: OllamaResponse = {
      model: 'llama3', created_at: new Date(start).toISOString(), done: true,
      message: { role: 'assistant', content: 'ok', tool_calls: [{ function: { name: 'lookup', arguments: { id: 1 } } }] },
    } as any;
    const evalRes = convertOllamaToEval2Otel(req, res, start);
    expect(evalRes.operation).toBe('execute_tool');
    expect(evalRes.response!.choices![0].message.toolCalls![0].function.name).toBe('lookup');
  });
});
