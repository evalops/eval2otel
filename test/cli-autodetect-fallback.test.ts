import * as fs from 'fs';

describe('CLI autodetect fallback to EvalResult', () => {
  const file = __dirname + '/tmp-fallback.jsonl';
  beforeAll(() => {
    fs.writeFileSync(file, JSON.stringify({
      id: 'fb1', timestamp: Date.now(), model: 'm', system: 'x', operation: 'chat',
      request: { model: 'm' }, response: {}, usage: {}, performance: { duration: 1 }
    }) + '\n');
  });
  afterAll(() => { try { fs.unlinkSync(file) } catch {} });

  it('treats unknown shapes as EvalResult when no --provider', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc']);
    expect(processEvaluation).toHaveBeenCalledTimes(1);
    const arg = processEvaluation.mock.calls[0][0];
    expect(arg.id).toBe('fb1');
  });
});
