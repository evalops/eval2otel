import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

describe('Converter agent and RAG events', () => {
  class SpanCap {
    public events: { name: string; attributes: Record<string, unknown> }[] = [];
    addEvent(name: string, attributes: Record<string, unknown>) {
      this.events.push({ name, attributes });
    }
    setStatus() {}
    recordException() {}
    end() {}
  }
  class TracerCap {
    public lastSpan: SpanCap | null = null;
    startSpan() {
      this.lastSpan = new SpanCap();
      return this.lastSpan as any;
    }
  }

  it('emits agent.step and rag.chunk events with expected attributes', () => {
    const tracer = new TracerCap();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const converter = new Eval2OtelConverter({
      serviceName: 'svc',
      captureContent: true,
      contentSampler: () => true,
    });

    const evalResult: EvalResult = {
      id: 'evt-1',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'agent_execution',
      request: { model: 'gpt-4' },
      response: { choices: [] },
      usage: {},
      performance: { duration: 1 },
      agent: {
        name: 'agent',
        steps: [
          { name: 's1', status: 'completed', duration: 100, type: 'tool' },
          { name: 's2', status: 'failed', error: 'boom' },
        ],
      },
      rag: {
        chunks: [
          { id: 'c1', source: 'doc', relevanceScore: 0.9, position: 0, tokens: 12 },
          { id: 'c2', source: 'doc2', relevanceScore: 0.8, position: 1 },
        ],
      },
    } as any;

    converter.convertEvalResult(evalResult);
    const span = tracer.lastSpan!;
    const agentEvents = span.events.filter(e => e.name === 'gen_ai.agent.step');
    const ragEvents = span.events.filter(e => e.name === 'gen_ai.rag.chunk');
    expect(agentEvents.length).toBe(2);
    expect(agentEvents[0].attributes['gen_ai.agent.step.index']).toBe(0);
    expect(agentEvents[0].attributes['gen_ai.agent.step.name']).toBe('s1');
    expect(agentEvents[0].attributes['gen_ai.agent.step.duration']).toBe(100);
    expect(agentEvents[0].attributes['gen_ai.agent.step.type']).toBe('tool');
    expect(agentEvents[1].attributes['gen_ai.agent.step.error']).toBe('boom');

    expect(ragEvents.length).toBe(2);
    expect(ragEvents[0].attributes['gen_ai.rag.chunk.index']).toBe(0);
    expect(ragEvents[0].attributes['gen_ai.rag.chunk.tokens']).toBe(12);
    expect(ragEvents[1].attributes['gen_ai.rag.chunk.id']).toBe('c2');
  });
});
