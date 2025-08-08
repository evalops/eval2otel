import { Eval2Otel, EvalResult } from '../src';

describe('Advanced Eval2Otel Features', () => {
  const eval2otel = new Eval2Otel({
    serviceName: 'advanced-test-service',
    serviceVersion: '2.0.0',
    captureContent: true,
    endpoint: 'http://localhost:4317',
  });

  it('should support text_completion operation', () => {
    const evalResult: EvalResult = {
      id: 'text-completion-test',
      timestamp: Date.now(),
      model: 'text-davinci-003',
      system: 'openai',
      operation: 'text_completion',
      
      request: {
        model: 'text-davinci-003',
        temperature: 0.5,
        maxTokens: 150,
      },
      
      response: {
        id: 'cmpl-123',
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'This is a text completion response.',
          },
        }],
      },
      
      usage: {
        inputTokens: 20,
        outputTokens: 25,
      },
      
      performance: {
        duration: 800,
      },
    };

    expect(() => {
      eval2otel.processEvaluation(evalResult);
    }).not.toThrow();
  });

  it('should support embeddings operation', () => {
    const evalResult: EvalResult = {
      id: 'embeddings-test',
      timestamp: Date.now(),
      model: 'text-embedding-ada-002',
      system: 'openai',
      operation: 'embeddings',
      
      request: {
        model: 'text-embedding-ada-002',
      },
      
      response: {
        id: 'emb-123',
      },
      
      usage: {
        inputTokens: 50,
      },
      
      performance: {
        duration: 300,
      },
    };

    expect(() => {
      eval2otel.processEvaluation(evalResult);
    }).not.toThrow();
  });

  it('should create custom evaluation counters', () => {
    const metrics = eval2otel.getMetrics();
    
    const customCounter = metrics.createEvalCounter(
      'custom_failures',
      'Number of custom evaluation failures'
    );

    expect(customCounter).toBeDefined();
    expect(customCounter.add).toBeDefined();
    
    // Should not throw when adding values
    expect(() => {
      customCounter.add(1, { 'eval.type': 'custom' });
    }).not.toThrow();
  });

  it('should create custom evaluation histograms', () => {
    const metrics = eval2otel.getMetrics();
    
    const customHistogram = metrics.createEvalHistogram(
      'custom_latency',
      'Custom evaluation latency'
    );

    expect(customHistogram).toBeDefined();
    expect(customHistogram.record).toBeDefined();
    
    // Should not throw when recording values
    expect(() => {
      customHistogram.record(0.5, { 'eval.type': 'custom' });
    }).not.toThrow();
  });

  it('should support batch processing', () => {
    const evalResults: EvalResult[] = [
      {
        id: 'batch-1',
        timestamp: Date.now(),
        model: 'gpt-3.5-turbo',
        system: 'openai',
        operation: 'chat',
        request: { model: 'gpt-3.5-turbo' },
        response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant' } }] },
        usage: { inputTokens: 10, outputTokens: 15 },
        performance: { duration: 1000 },
      },
      {
        id: 'batch-2',
        timestamp: Date.now(),
        model: 'gpt-3.5-turbo',
        system: 'openai',
        operation: 'chat',
        request: { model: 'gpt-3.5-turbo' },
        response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant' } }] },
        usage: { inputTokens: 12, outputTokens: 18 },
        performance: { duration: 1200 },
      },
    ];

    expect(() => {
      eval2otel.processEvaluations(evalResults);
    }).not.toThrow();
  });

  it('should support all quality metrics', () => {
    const evalResult: EvalResult = {
      id: 'quality-metrics-test',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      request: { model: 'gpt-4' },
      response: { choices: [{ index: 0, finishReason: 'stop', message: { role: 'assistant' } }] },
      usage: { inputTokens: 10, outputTokens: 15 },
      performance: { duration: 1000 },
    };

    expect(() => {
      eval2otel.processEvaluationWithMetrics(evalResult, {
        accuracy: 0.95,
        precision: 0.92,
        recall: 0.88,
        f1Score: 0.90,
        bleuScore: 0.85,
        rougeScore: 0.82,
        toxicity: 0.02,
        relevance: 0.94,
      });
    }).not.toThrow();
  });

  it('should handle tool execution with complex arguments', () => {
    const evalResult: EvalResult = {
      id: 'complex-tool-test',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'execute_tool',
      
      request: {
        model: 'gpt-4',
      },
      
      response: {
        choices: [{
          index: 0,
          finishReason: 'tool_calls',
          message: {
            role: 'assistant',
            toolCalls: [{
              id: 'call_complex',
              type: 'function',
              function: {
                name: 'complex_calculation',
                arguments: {
                  operation: 'multiply',
                  operands: [42, 13],
                  options: {
                    precision: 2,
                    returnType: 'number'
                  }
                },
              },
            }],
          },
        }],
      },
      
      usage: {
        inputTokens: 100,
        outputTokens: 50,
      },
      
      performance: {
        duration: 2000,
        timeToFirstToken: 300,
        timePerOutputToken: 40,
      },
      
      tool: {
        name: 'complex_calculation',
        description: 'Performs complex mathematical calculations',
        callId: 'call_complex',
        result: {
          value: 546,
          metadata: {
            executionTime: 0.05,
            cacheHit: false
          }
        },
      },
    };

    expect(() => {
      eval2otel.processEvaluation(evalResult);
    }).not.toThrow();
  });

  it('should handle errors in evaluations', () => {
    const evalResult: EvalResult = {
      id: 'error-test',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
      },
      
      response: {
        choices: [],
      },
      
      usage: {
        inputTokens: 25,
        outputTokens: 0,
      },
      
      performance: {
        duration: 5000,
      },
      
      error: {
        type: 'timeout',
        message: 'Request timed out after 5 seconds',
      },
    };

    expect(() => {
      eval2otel.processEvaluation(evalResult);
    }).not.toThrow();
  });

  afterAll(async () => {
    await eval2otel.shutdown();
  });
});
