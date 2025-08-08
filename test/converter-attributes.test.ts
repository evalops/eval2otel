import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult } from '../src/types';

describe('Converter span attributes and sampling branches', () => {
  class CapturingSpan {
    addEvent() {}
    setStatus() {}
    recordException() {}
    end() {}
  }
  class CapturingTracer {
    public lastName: string | null = null;
    public lastOptions: any = null;
    startSpan(name: string, options: any) {
      this.lastName = name;
      this.lastOptions = options;
      return new CapturingSpan() as any;
    }
  }

  const baseEval: EvalResult = {
    id: 'attr-1',
    timestamp: Date.now(),
    model: 'gpt-4',
    system: 'openai',
    operation: 'chat',
    request: { model: 'gpt-4' },
    response: {},
    usage: {},
    performance: { duration: 1 },
  } as any;

  it('maps workflow_step to gen_ai.workflow span name', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' });
    conv.convertEvalResult({ ...baseEval, operation: 'workflow_step' } as any);
    expect(tracer.lastName).toBe('gen_ai.workflow');
  });

  it('respects captureContent=false and sampleContentRate extremes', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);

    // captureContent=false produces span but no events; here we only check it does not throw
    const conv1 = new Eval2OtelConverter({ serviceName: 'svc', captureContent: false });
    conv1.convertEvalResult(baseEval);

    // sampleContentRate=1 yields eligible content capture path (no assertion on events here)
    const conv2 = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, sampleContentRate: 1 });
    conv2.convertEvalResult(baseEval);

    // sampleContentRate=0 should skip content capture logic
    const conv3 = new Eval2OtelConverter({ serviceName: 'svc', captureContent: true, sampleContentRate: 0 });
    conv3.convertEvalResult(baseEval);
  });

  it('sets rich attributes including workflow, agent, rag, request arrays, error, and merges additional', () => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' });
    const evalResult: EvalResult = {
      id: 'attr-2',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'agent_execution',
      request: {
        model: 'gpt-4',
        temperature: 0.2,
        maxTokens: 100,
        topP: 0.9,
        topK: 40,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        stopSequences: ['\n\n'],
        seed: 123,
        choiceCount: 2,
      },
      response: { id: 'rid', model: 'gpt-4', finishReasons: ['stop'] },
      usage: { inputTokens: 10, outputTokens: 20 },
      performance: { duration: 1 },
      error: { type: 'BadInput', message: 'oops' },
      conversation: { id: 'conv-1', messages: [{ role: 'user', content: 'hi', toolCallId: 't1' }] },
      tool: { name: 'func', description: 'desc', callId: 'call-1' },
      agent: { name: 'a1', type: 'orchestrator', plan: 'p', reasoning: 'r', steps: [
        { name: 's1', status: 'running', type: 'step', duration: 1 },
        { name: 's2', status: 'completed', error: 'e' },
      ] },
      workflow: { id: 'w1', name: 'wf', step: 's', parentWorkflowId: 'w0' },
      rag: {
        retrievalMethod: 'hybrid',
        documentsRetrieved: 3,
        documentsUsed: 2,
        metrics: { contextPrecision: 0.8, contextRecall: 0.9, answerRelevance: 0.95, faithfulness: 0.85 },
      },
    } as any;
    conv.convertEvalResult(evalResult, { attributes: { 'custom.attr': 'yes' } });
    const attrs = tracer.lastOptions.attributes;
    expect(attrs['gen_ai.operation.name']).toBe('agent_execution');
    expect(attrs['gen_ai.request.stop_sequences']).toEqual(['\n\n']);
    expect(attrs['gen_ai.response.finish_reasons']).toEqual(['stop']);
    expect(attrs['gen_ai.usage.input_tokens']).toBe(10);
    expect(attrs['error.type']).toBe('BadInput');
    expect(attrs['gen_ai.conversation.id']).toBe('conv-1');
    expect(attrs['gen_ai.tool.call.id']).toBe('call-1');
    expect(attrs['gen_ai.agent.current_step']).toBe('s1');
    expect(attrs['gen_ai.agent.total_steps']).toBe(2);
    expect(attrs['gen_ai.workflow.id']).toBe('w1');
    expect(attrs['gen_ai.rag.retrieval_method']).toBe('hybrid');
    expect(attrs['gen_ai.rag.context_precision']).toBe(0.8);
    expect(attrs['custom.attr']).toBe('yes');
  });
});
