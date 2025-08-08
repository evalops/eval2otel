import { createEval2Otel, EvalResult } from '../src';

describe('Eval2Otel', () => {
  it('should initialize without errors', () => {
    const eval2otel = createEval2Otel({
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      captureContent: false,
    });

    expect(eval2otel).toBeDefined();
    expect(eval2otel.getConverter).toBeDefined();
    expect(eval2otel.getMetrics).toBeDefined();
  });

  it('should process a basic evaluation result', () => {
    const eval2otel = createEval2Otel({
      serviceName: 'test-service',
      captureContent: false,
    });

    const evalResult: EvalResult = {
      id: 'test-eval-123',
      timestamp: Date.now(),
      model: 'test-model',
      system: 'test-system',
      operation: 'chat',
      
      request: {
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 100,
      },
      
      response: {
        id: 'resp-123',
        model: 'test-model',
        finishReasons: ['stop'],
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Test response',
          },
        }],
      },
      
      usage: {
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25,
      },
      
      performance: {
        duration: 1000,
      },
    };

    // Should not throw an error
    expect(() => {
      eval2otel.processEvaluation(evalResult);
    }).not.toThrow();
  });

  it('should process evaluation with quality metrics', () => {
    const eval2otel = createEval2Otel({
      serviceName: 'test-service',
      captureContent: false,
    });

    const evalResult: EvalResult = {
      id: 'test-eval-456',
      timestamp: Date.now(),
      model: 'test-model',
      system: 'test-system',
      operation: 'chat',
      
      request: {
        model: 'test-model',
      },
      
      response: {
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Test response',
          },
        }],
      },
      
      usage: {
        inputTokens: 5,
        outputTokens: 10,
      },
      
      performance: {
        duration: 500,
      },
    };

    // Should not throw an error
    expect(() => {
      eval2otel.processEvaluationWithMetrics(evalResult, {
        accuracy: 0.95,
        relevance: 0.88,
        toxicity: 0.02,
      });
    }).not.toThrow();
  });

  afterAll(async () => {
    // Clean up any initialized instances
    const eval2otel = createEval2Otel({
      serviceName: 'cleanup-test',
    });
    await eval2otel.shutdown();
  });
});
