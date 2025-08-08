import { createEval2Otel, EvalResult } from '../src';

// Create the eval2otel instance
const eval2otel = createEval2Otel({
  serviceName: 'ai-agent-system',
  serviceVersion: '1.0.0',
  environment: 'development',
  captureContent: true,
});

// Example 1: Agent execution with multiple steps
const agentEvalResult: EvalResult = {
  id: 'agent-exec-123',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'agent_execution',
  
  request: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  },
  
  response: {
    id: 'resp-agent-456',
    finishReasons: ['stop'],
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: 'I have completed the research task. Here is a summary of findings...',
      },
    }],
  },
  
  usage: {
    inputTokens: 150,
    outputTokens: 320,
    totalTokens: 470,
  },
  
  performance: {
    duration: 8.5, // seconds
  },
  
  agent: {
    name: 'research-agent',
    type: 'orchestrator',
    plan: 'search -> analyze -> summarize',
    reasoning: 'Need to gather information from multiple sources before providing comprehensive answer',
    steps: [
      {
        name: 'search',
        type: 'retrieval',
        status: 'completed',
        duration: 2000,
      },
      {
        name: 'analyze',
        type: 'processing',
        status: 'completed',
        duration: 3500,
      },
      {
        name: 'summarize',
        type: 'generation',
        status: 'completed',
        duration: 3000,
      },
    ],
  },
};

// Process the agent evaluation
eval2otel.processEvaluation(agentEvalResult);

// Example 2: RAG evaluation with document retrieval
const ragEvalResult: EvalResult = {
  id: 'rag-eval-789',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'chat',
  
  request: {
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 1000,
  },
  
  response: {
    id: 'resp-rag-101',
    finishReasons: ['stop'],
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: 'Based on the documentation, the answer is...',
      },
    }],
  },
  
  usage: {
    inputTokens: 450,
    outputTokens: 180,
    totalTokens: 630,
  },
  
  performance: {
    duration: 3.2, // seconds
  },
  
  conversation: {
    id: 'conv-rag-202',
    messages: [
      {
        role: 'user',
        content: 'What is the recommended configuration for production?',
      },
    ],
  },
  
  rag: {
    retrievalMethod: 'hybrid',
    documentsRetrieved: 10,
    documentsUsed: 3,
    chunks: [
      {
        id: 'doc1_chunk3',
        source: 'production-guide.md',
        relevanceScore: 0.92,
        position: 0,
        tokens: 256,
      },
      {
        id: 'doc2_chunk1',
        source: 'best-practices.md',
        relevanceScore: 0.87,
        position: 1,
        tokens: 189,
      },
      {
        id: 'doc3_chunk5',
        source: 'config-reference.md',
        relevanceScore: 0.81,
        position: 2,
        tokens: 142,
      },
    ],
    metrics: {
      contextPrecision: 0.88,
      contextRecall: 0.91,
      answerRelevance: 0.93,
      faithfulness: 0.95,
    },
  },
};

// Process the RAG evaluation with quality metrics
eval2otel.processEvaluationWithMetrics(ragEvalResult, {
  accuracy: 0.94,
  relevance: 0.89,
  toxicity: 0.02,
});

// Example 3: Workflow step tracking
const workflowStepResult: EvalResult = {
  id: 'workflow-step-303',
  timestamp: Date.now(),
  model: 'gpt-4',
  system: 'openai',
  operation: 'workflow_step',
  
  request: {
    model: 'gpt-4',
    temperature: 0.5,
    maxTokens: 500,
  },
  
  response: {
    id: 'resp-workflow-404',
    finishReasons: ['stop'],
    choices: [{
      index: 0,
      finishReason: 'stop',
      message: {
        role: 'assistant',
        content: 'Step completed successfully',
      },
    }],
  },
  
  usage: {
    inputTokens: 80,
    outputTokens: 60,
    totalTokens: 140,
  },
  
  performance: {
    duration: 1.2, // seconds
  },
  
  workflow: {
    id: 'wf-main-505',
    name: 'data-processing-pipeline',
    step: 'validation',
    totalSteps: 5,
    state: {
      currentStep: 2,
      validationPassed: true,
      recordsProcessed: 150,
    },
  },
};

// Process the workflow step
eval2otel.processEvaluation(workflowStepResult);

console.log('Agent, RAG, and workflow evaluations processed!');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await eval2otel.shutdown();
  process.exit(0);
});
