import { Eval2Otel, EvalResult } from '../src';

describe('Agent and RAG Features', () => {
  const eval2otel = new Eval2Otel({
    serviceName: 'test-agent-rag-service',
    serviceVersion: '1.0.0',
    captureContent: true,
  });

  it('should handle agent execution with steps', () => {
    const agentResult: EvalResult = {
      id: 'agent-test-1',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'agent_execution',
      
      request: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
      },
      
      response: {
        id: 'resp-agent-1',
        finishReasons: ['stop'],
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Agent task completed',
          },
        }],
      },
      
      usage: {
        inputTokens: 100,
        outputTokens: 200,
      },
      
      performance: {
        duration: 5000,
      },
      
      agent: {
        name: 'test-agent',
        type: 'orchestrator',
        plan: 'plan -> execute -> review',
        reasoning: 'Following standard workflow',
        steps: [
          {
            name: 'plan',
            status: 'completed',
            duration: 1000,
          },
          {
            name: 'execute',
            status: 'completed',
            duration: 3000,
          },
          {
            name: 'review',
            status: 'completed',
            duration: 1000,
          },
        ],
      },
    };

    expect(() => {
      eval2otel.processEvaluation(agentResult);
    }).not.toThrow();
  });

  it('should handle RAG evaluation with chunks', () => {
    const ragResult: EvalResult = {
      id: 'rag-test-1',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 500,
      },
      
      response: {
        id: 'resp-rag-1',
        finishReasons: ['stop'],
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Based on retrieved documents...',
          },
        }],
      },
      
      usage: {
        inputTokens: 300,
        outputTokens: 150,
      },
      
      performance: {
        duration: 2500,
      },
      
      rag: {
        retrievalMethod: 'vector_search',
        documentsRetrieved: 5,
        documentsUsed: 2,
        chunks: [
          {
            id: 'chunk-1',
            source: 'doc1.md',
            relevanceScore: 0.95,
            position: 0,
            tokens: 200,
          },
          {
            id: 'chunk-2',
            source: 'doc2.md',
            relevanceScore: 0.88,
            position: 1,
            tokens: 150,
          },
        ],
        metrics: {
          contextPrecision: 0.9,
          contextRecall: 0.85,
          answerRelevance: 0.92,
          faithfulness: 0.94,
        },
      },
    };

    expect(() => {
      eval2otel.processEvaluation(ragResult);
    }).not.toThrow();
  });

  it('should handle workflow steps', () => {
    const workflowResult: EvalResult = {
      id: 'workflow-test-1',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'workflow_step',
      
      request: {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 200,
      },
      
      response: {
        id: 'resp-workflow-1',
        finishReasons: ['stop'],
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
            content: 'Workflow step completed',
          },
        }],
      },
      
      usage: {
        inputTokens: 50,
        outputTokens: 30,
      },
      
      performance: {
        duration: 800,
      },
      
      workflow: {
        id: 'wf-123',
        name: 'test-workflow',
        step: 'processing',
        totalSteps: 3,
        parentWorkflowId: 'wf-parent-456',
        state: {
          currentStep: 2,
          status: 'running',
        },
      },
    };

    expect(() => {
      eval2otel.processEvaluation(workflowResult);
    }).not.toThrow();
  });

  it('should handle agent with error in step', () => {
    const agentWithError: EvalResult = {
      id: 'agent-error-test',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'agent_execution',
      
      request: {
        model: 'gpt-4',
      },
      
      response: {
        choices: [],
      },
      
      usage: {
        inputTokens: 100,
        outputTokens: 0,
      },
      
      performance: {
        duration: 3000,
      },
      
      error: {
        type: 'tool_execution_failed',
        message: 'Tool returned an error',
      },
      
      agent: {
        name: 'failing-agent',
        steps: [
          {
            name: 'search',
            status: 'completed',
            duration: 1000,
          },
          {
            name: 'process',
            status: 'failed',
            duration: 2000,
            error: 'Processing failed: Invalid data format',
          },
        ],
      },
    };

    expect(() => {
      eval2otel.processEvaluation(agentWithError);
    }).not.toThrow();
  });

  it('should process RAG metrics correctly', () => {
    const ragWithMetrics: EvalResult = {
      id: 'rag-metrics-test',
      timestamp: Date.now(),
      model: 'gpt-4',
      system: 'openai',
      operation: 'chat',
      
      request: {
        model: 'gpt-4',
      },
      
      response: {
        choices: [{
          index: 0,
          finishReason: 'stop',
          message: {
            role: 'assistant',
          },
        }],
      },
      
      usage: {
        inputTokens: 200,
        outputTokens: 100,
      },
      
      performance: {
        duration: 1500,
      },
      
      rag: {
        documentsRetrieved: 8,
        documentsUsed: 3,
        metrics: {
          contextPrecision: 0.87,
          contextRecall: 0.92,
          answerRelevance: 0.89,
          faithfulness: 0.91,
        },
      },
    };

    expect(() => {
      eval2otel.processEvaluationWithMetrics(ragWithMetrics, {
        bleuScore: 0.85,
        rougeScore: 0.88,
      });
    }).not.toThrow();
  });

  afterAll(async () => {
    await eval2otel.shutdown();
  });
});