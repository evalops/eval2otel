import {
  convertDeepEvalResult,
  convertDeepEvalToEvalResults,
  convertRagasResult,
  convertRagasToEvalResults,
} from '../src/integrations';

describe('RAGAS integration adapter', () => {
  it('converts RAGAS rows into EvalResult RAG metrics and chunk evidence', () => {
    const converted = convertRagasToEvalResults({
      scores: [{
        id: 'ragas-case-1',
        user_input: 'What shipped?',
        response: 'The release added adapters.',
        reference: 'Adapters shipped.',
        retrieved_contexts: [
          'release notes mention adapters',
          { id: 'doc-2', source: 'contract.md', text: 'RAG metrics are tracked', score: 0.8, citation_id: 'cite-2' },
        ],
        faithfulness: 0.91,
        context_precision: 0.82,
        context_recall: 0.74,
        answer_relevancy: 0.88,
        latency_ms: 250,
      }],
    }, {
      runId: 'ragas-run',
      datasetId: 'rag-evals',
      datasetVersion: '2026.05',
      defaultModel: 'gpt-4o-mini',
      timestamp: 1700000000000,
    });

    expect(converted.warnings).toEqual([]);
    expect(converted.evalResults).toHaveLength(1);
    const result = converted.evalResults[0];
    expect(result.id).toBe('ragas-run-ragas-case-1');
    expect(result.provenance).toMatchObject({
      sourceFramework: 'ragas',
      adapter: 'ragas',
      datasetId: 'rag-evals',
    });
    expect(result.performance.duration).toBe(0.25);
    expect(result.rag?.documentsRetrieved).toBe(2);
    expect(result.rag?.chunks?.[0].evidenceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rag?.chunks?.[1]).toMatchObject({ id: 'doc-2', source: 'contract.md', relevanceScore: 0.8, citationId: 'cite-2' });
    expect(result.rag?.metrics).toMatchObject({
      faithfulness: 0.91,
      contextPrecision: 0.82,
      contextRecall: 0.74,
      answerRelevance: 0.88,
    });
    expect(result.provider?.attributes).toMatchObject({
      'eval.ragas.faithfulness': 0.91,
      'eval.ragas.context_precision': 0.82,
      'eval.ragas.answer_relevance': 0.88,
    });
    expect(result.provider?.attributes?.['eval.ragas.metric_names']).toEqual(expect.arrayContaining(['faithfulness', 'answer_relevance']));
    expect(result.provider?.attributes?.['eval.ragas.reference_sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('converts a single RAGAS result object and reports invalid rows', () => {
    const single = convertRagasResult({
      question: 'Q',
      answer: 'A',
      contexts: [],
      duration: 1.5,
    }, 0, { runId: 'run' });
    expect(single.id).toBe('run-ragas-0');
    expect(single.performance.duration).toBe(1.5);

    const converted = convertRagasToEvalResults({ rows: [null] });
    expect(converted.evalResults).toEqual([]);
    expect(converted.warnings[0].code).toBe('ragas.row_invalid');
  });
});

describe('DeepEval integration adapter', () => {
  it('converts DeepEval test results with metric scores, warnings, and RAG context', () => {
    const converted = convertDeepEvalToEvalResults({
      testResults: [{
        testCaseId: 'case-9',
        input: 'Explain the release',
        actualOutput: 'It added RAGAS and DeepEval adapters.',
        expectedOutput: 'Adapters were added.',
        retrievalContext: ['release notes', 'adapter docs'],
        success: false,
        latencyMs: 750,
        metrics: [
          { name: 'G-Eval', score: 0.66, success: false, reason: 'Needs stronger explanation.' },
          { name: 'Answer Relevancy', score: 0.93, success: true },
        ],
      }],
    }, {
      runId: 'deepeval-run',
      includeExplanations: true,
      defaultModel: 'gpt-4o-mini',
      timestamp: 1700000000000,
    });

    expect(converted.warnings).toEqual([]);
    expect(converted.evalResults).toHaveLength(1);
    const result = converted.evalResults[0];
    expect(result.id).toBe('deepeval-run-case-9');
    expect(result.operation).toBe('chat');
    expect(result.performance.duration).toBe(0.75);
    expect(result.response.finishReasons).toEqual(['fail']);
    expect(result.rag?.chunks).toHaveLength(2);
    expect(result.provider?.attributes).toMatchObject({
      'eval.deepeval.success': false,
      'eval.deepeval.failed_metric_count': 1,
      'eval.deepeval.g_eval': 0.66,
      'eval.deepeval.answer_relevancy': 0.93,
    });
    expect(result.evidence?.warningCount).toBe(1);
    expect(result.evidence?.warnings?.[0].message).toContain('Needs stronger explanation');
  });

  it('supports object-style metrics and invalid row warnings', () => {
    const result = convertDeepEvalResult({
      id: 'case-object',
      input: { prompt: 'hello' },
      output: 'world',
      metrics: {
        toxicity: 0.01,
        faithfulness: { score: 0.8, passed: true },
      },
      duration: 2,
    }, 0, { runId: 'run' });

    expect(result.id).toBe('run-case-object');
    expect(result.provider?.attributes).toMatchObject({
      'eval.deepeval.toxicity': 0.01,
      'eval.deepeval.faithfulness': 0.8,
    });
    expect(result.conversation?.messages[0].content).toBe('{"prompt":"hello"}');

    const converted = convertDeepEvalToEvalResults({ results: [null] });
    expect(converted.evalResults).toEqual([]);
    expect(converted.warnings[0].code).toBe('deepeval.row_invalid');
  });
});
