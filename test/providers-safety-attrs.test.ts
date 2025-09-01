import { trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import {
  convertBedrockToEval2Otel,
  convertAzureOpenAIToEval2Otel,
  convertVertexToEval2Otel,
} from '../src/providers';

class CapturingTracer { lastOptions:any; startSpan(_n:string, options:any){ this.lastOptions = options; return { addEvent() {}, setStatus() {}, recordException() {}, end() {} } as any; } }

describe('Provider safety/provider-specific attributes', () => {
  it('Bedrock maps stop_reason and guardrail trace', () => {
    const start = Date.now(); const end = start + 1000;
    const evalRes = convertBedrockToEval2Otel(
      { modelId: 'cohere.command' } as any,
      { modelId: 'cohere.command', outputText: 'ok', stopReason: 'guardrail', guardrailTrace: { id: 'gr1' } } as any,
      start, end
    );
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    conv.convertEvalResult(evalRes);
    expect(tracer.lastOptions.attributes['aws.bedrock.stop_reason']).toBe('guardrail');
    expect(tracer.lastOptions.attributes['aws.bedrock.guardrail.trace']).toContain('"id":"gr1"');
  });

  it('Azure OpenAI maps prompt_filter_results when present', () => {
    const start = Date.now(); const end = start + 1000;
    const evalRes = convertAzureOpenAIToEval2Otel(
      { model: 'gpt-4o' } as any,
      { id: 'id', created: Math.floor(start/1000), model: 'gpt-4o', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }], prompt_filter_results: [{ flagged: false }] } as any,
      start, end
    );
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    conv.convertEvalResult(evalRes);
    expect(tracer.lastOptions.attributes['azure.openai.prompt_filter_results']).toContain('flagged');
  });

  it('Vertex maps safety ratings when present', () => {
    const start = Date.now(); const end = start + 1000;
    const evalRes = convertVertexToEval2Otel(
      { model: 'gemini-1.5' } as any,
      { model: 'gemini-1.5', candidates: [{ content: { role: 'assistant', parts: [{ text: 'ok' }] }, safetyRatings: [{ category: 'HATE', probability: 'LOW' }] }] } as any,
      start, end
    );
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const conv = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    conv.convertEvalResult(evalRes);
    expect(tracer.lastOptions.attributes['google.vertex.safety_ratings']).toContain('HATE');
  });
});
