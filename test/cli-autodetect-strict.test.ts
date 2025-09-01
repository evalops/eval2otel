import * as fs from 'fs';

describe('CLI autodetect strict (no fallback)', () => {
  const file = __dirname + '/tmp-strict.jsonl';
  beforeAll(() => {
    fs.writeFileSync(file, JSON.stringify({
      // Unknown provider shape but includes request/response keys
      startTime: Date.now(), endTime: Date.now()+100,
      request: { any: 'thing' }, response: { any: 'thing' },
    }) + '\n');
  });
  afterAll(() => { try { fs.unlinkSync(file) } catch {} });

  it('skips processing and logs error when autodetect fails and --autodetect-strict is set', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(()=>{});
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc', '--autodetect-strict']);
    expect(errorSpy).toHaveBeenCalled();
    expect(processEvaluation).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
