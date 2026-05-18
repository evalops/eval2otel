import { convertPromptfooResult, convertPromptfooToEvalResults } from '../src/integrations';

describe('Promptfoo integration adapter', () => {
  it('converts nested Promptfoo results with provenance, scores, and failed assertion warnings', () => {
    const converted = convertPromptfooToEvalResults({
      results: {
        results: [{
          id: 7,
          prompt: 'Translate hello to French',
          provider: { id: 'openai:gpt-4o-mini' },
          response: 'bonjour',
          success: false,
          score: 0.25,
          namedScores: { toxicity: 0.01 },
          latencyMs: 1234,
          assertions: [{
            type: 'contains',
            pass: false,
            reason: 'expected Bonjour with capital B',
          }],
        }],
      },
    }, {
      runId: 'promptfoo-run-1',
      datasetId: 'i18n',
      datasetVersion: '2026.05',
      defaultSystem: 'promptfoo',
      timestamp: 1700000000000,
    });

    expect(converted.warnings).toEqual([]);
    expect(converted.evalResults).toHaveLength(1);
    const [evalResult] = converted.evalResults;
    expect(evalResult.id).toBe('promptfoo-run-1-7');
    expect(evalResult.timestamp).toBe(1700000000000);
    expect(evalResult.system).toBe('promptfoo');
    expect(evalResult.model).toBe('openai:gpt-4o-mini');
    expect(evalResult.performance.duration).toBeCloseTo(1.234);
    expect(evalResult.provider?.attributes).toMatchObject({
      'eval.promptfoo.success': false,
      'eval.promptfoo.score': 0.25,
      'eval.promptfoo.assertion_count': 1,
      'eval.promptfoo.failed_assertion_count': 1,
      'eval.promptfoo.metric_names': ['toxicity'],
    });
    expect(evalResult.provenance).toMatchObject({
      sourceFramework: 'promptfoo',
      runId: 'promptfoo-run-1',
      caseId: '7',
      datasetId: 'i18n',
      datasetVersion: '2026.05',
      adapter: 'promptfoo',
      contractVersion: 'eval2otel.v1',
    });
    expect(evalResult.evidence?.rawPayloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evalResult.evidence?.warningCount).toBe(1);
    expect(evalResult.evidence?.warnings?.[0].code).toBe('promptfoo.assertion_failed');
  });

  it('supports table payloads, var-only prompts, and invalid row warnings', () => {
    const converted = convertPromptfooToEvalResults({
      table: [
        {
          vars: { question: '2+2?' },
          output: { answer: '4' },
          gradingResult: { pass: true, score: 1 },
        },
        null,
      ],
    }, { defaultModel: 'gpt-4o-mini' });

    expect(converted.evalResults).toHaveLength(1);
    expect(converted.evalResults[0].conversation?.messages[0].content).toBe('{"question":"2+2?"}');
    expect(converted.evalResults[0].response.choices?.[0].message.content).toBe('{"answer":"4"}');
    expect(converted.warnings).toHaveLength(1);
    expect(converted.warnings[0].code).toBe('promptfoo.row_invalid');
  });

  it('converts a single parsed Promptfoo result shape', () => {
    const evalResult = convertPromptfooResult({
      id: 'case-a',
      prompt: ['hello'],
      output: 'world',
      assertions: [],
    }, 0, { runId: 'run-a', defaultModel: 'model-a' });

    expect(evalResult.id).toBe('run-a-case-a');
    expect(evalResult.conversation?.messages[0].content).toBe('["hello"]');
    expect(evalResult.response.finishReasons).toEqual(['pass']);
  });
});
