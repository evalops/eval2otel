import * as fs from 'fs';

describe('CLI provider mode unknown', () => {
  const file = __dirname + '/tmp-provider-unk.jsonl';
  beforeAll(() => {
    fs.writeFileSync(file, JSON.stringify({
      startTime: Date.now(), endTime: Date.now()+100,
      request: { model: 'x', messages: [{ role: 'user', content: 'hi' }] },
      response: { id: 'r', model: 'x', choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] }
    }) + '\n');
  });
  afterAll(() => { try { fs.unlinkSync(file) } catch {} });

  it('logs error and continues without processing', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(()=>{});
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc', '--provider', 'unknown-provider']);
    expect(errorSpy).toHaveBeenCalled();
    expect(processEvaluation).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
