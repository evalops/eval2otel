import * as fs from 'fs';

describe('CLI autodetect openai-compatible', () => {
  const file = __dirname + '/tmp-openai-compat.jsonl';
  beforeAll(() => {
    fs.writeFileSync(file, JSON.stringify({
      startTime: Date.now(), endTime: Date.now()+100,
      request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      response: {
        id: 'id', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content: 'ok', tool_calls: [{ id: 't', type: 'function', function: { name: 'f', arguments: '{"x":1}' } }] }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      }
    }) + '\n');
  });
  afterAll(() => { try { fs.unlinkSync(file) } catch {} });

  it('detects and processes without --provider', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc']);
    expect(processEvaluation).toHaveBeenCalledTimes(1);
    const arg = processEvaluation.mock.calls[0][0];
    expect(arg.operation).toBe('execute_tool');
  });
});
