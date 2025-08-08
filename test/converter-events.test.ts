import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

describe('Converter events', () => {
  class FakeSpan {
    public events: { name: string; attributes: Record<string, unknown> }[] = [];
    addEvent(name: string, attributes: Record<string, unknown>) {
      this.events.push({ name, attributes });
    }
    setStatus() {}
    recordException() {}
    end() {}
  }
  class FakeTracer {
    public lastSpan: FakeSpan | null = null;
    startSpan() {
      this.lastSpan = new FakeSpan();
      return this.lastSpan as any;
    }
  }

  it('emits standardized tool event attributes and truncates content', () => {
    const fakeTracer = new FakeTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(fakeTracer as any);

    const converter = new Eval2OtelConverter({
      serviceName: 'svc',
      captureContent: true,
      contentMaxLength: 10,
      contentSampler: () => true,
    });

    const evalResult: EvalResult = {
      id: 'id1',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      request: { model: 'gpt-4' },
      response: {
        choices: [
          {
            index: 0,
            finishReason: 'stop',
            message: {
              role: 'assistant',
              content: 'this is a long content string',
              toolCalls: [
                {
                  id: 'call1',
                  type: 'function',
                  function: {
                    name: 'calc',
                    arguments: { alpha: '0123456789012345' },
                  },
                },
              ],
            },
          },
        ],
      },
      usage: {},
      performance: { duration: 1 },
    } as any;

    converter.convertEvalResult(evalResult);
    const span = fakeTracer.lastSpan!;
    const toolEvent = span.events.find((e) => e.name === 'gen_ai.tool.message');
    expect(toolEvent).toBeDefined();
    expect(toolEvent!.attributes['gen_ai.tool.name']).toBe('calc');
    expect(toolEvent!.attributes['gen_ai.tool.call.id']).toBe('call1');
    expect(toolEvent!.attributes['gen_ai.response.choice.index']).toBe(0);
    const args = String(toolEvent!.attributes['gen_ai.tool.arguments']);
    expect(args.length).toBeLessThanOrEqual(10);

    const assistantEvent = span.events.find((e) => e.name === 'gen_ai.assistant.message');
    expect(assistantEvent).toBeDefined();
    const msgContent = String(assistantEvent!.attributes['message.content']);
    expect(msgContent.length).toBeLessThanOrEqual(10);
  });

  it('skips content events when sampler returns false', () => {
    const fakeTracer = new FakeTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(fakeTracer as any);
    const converter = new Eval2OtelConverter({
      serviceName: 'svc',
      captureContent: true,
      contentSampler: () => false,
    });
    const evalResult: EvalResult = {
      id: 'id2',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      request: { model: 'gpt-4' },
      response: { choices: [] },
      usage: {},
      performance: { duration: 1 },
    } as any;
    converter.convertEvalResult(evalResult);
    const span = fakeTracer.lastSpan!;
    expect(span.events.length).toBe(0);
  });

  it('applies per-field redaction hooks', () => {
    const fakeTracer = new FakeTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(fakeTracer as any);
    const converter = new Eval2OtelConverter({
      serviceName: 'svc',
      captureContent: true,
      contentSampler: () => true,
      redactMessageContent: (c, { role }) => (role === 'assistant' ? '[REDACTED]' : c),
      redactToolArguments: () => '[ARGS]'.toString(),
    });
    const evalResult: EvalResult = {
      id: 'id3',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      request: { model: 'gpt-4' },
      response: {
        choices: [
          {
            index: 0,
            finishReason: 'stop',
            message: {
              role: 'assistant',
              content: 'SECRET',
              toolCalls: [
                {
                  id: 'call1',
                  type: 'function',
                  function: { name: 'calc', arguments: { a: 1 } },
                },
              ],
            },
          },
        ],
      },
      usage: {},
      performance: { duration: 1 },
    } as any;
    converter.convertEvalResult(evalResult);
    const span = fakeTracer.lastSpan!;
    const assistantEvent = span.events.find((e) => e.name === 'gen_ai.assistant.message');
    expect(assistantEvent!.attributes['message.content']).toBe('[REDACTED]');
    const toolEvent = span.events.find((e) => e.name === 'gen_ai.tool.message');
    expect(toolEvent!.attributes['gen_ai.tool.arguments']).toBe('[ARGS]');
  });
});

