import * as fs from 'fs';

describe('CLI provider mode', () => {
  const file = __dirname + '/tmp-provider.jsonl';
  beforeAll(() => {
    fs.writeFileSync(file, JSON.stringify({
      startTime: Date.now(), endTime: Date.now()+100,
      request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
      response: {
        id: 'chatcmpl-1', object: 'chat.completion', created: Math.floor(Date.now()/1000), model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      }
    }) + '\n');
  });
  afterAll(() => { try { fs.unlinkSync(file) } catch {} });

  it('converts provider-native line with --provider openai-chat', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc', '--provider', 'openai-chat']);
    expect(processEvaluation).toHaveBeenCalledTimes(1);
    const evalArg = processEvaluation.mock.calls[0][0];
    expect(evalArg.system).toBe('openai');
    expect(evalArg.response.finishReasons).toEqual(['stop']);
  });
});
