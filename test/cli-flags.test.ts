import * as fs from 'fs';

describe('CLI flags wiring', () => {
  const file = __dirname + '/tmp-flags.jsonl';
  beforeAll(() => {
    fs.writeFileSync(file, JSON.stringify({
      id: 'f1', timestamp: Date.now(), model: 'm', system: 'x', operation: 'chat',
      request: { model: 'm' }, response: {}, usage: {}, performance: { duration: 1 }
    }) + '\n');
  });
  afterAll(() => { try { fs.unlinkSync(file) } catch {} });

  it('parses sample-rate, content-cap, redact-pattern, with-exemplars', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc', '--sample-rate', '0.25', '--content-cap', '123', '--redact-pattern', 'foo', '--with-exemplars']);
    const cfg = createEval2Otel.mock.calls[0][0];
    expect(cfg.sampleContentRate).toBe(0.25);
    expect(cfg.contentMaxLength).toBe(123);
    expect(typeof cfg.redact).toBe('function');
    expect(cfg.enableExemplars).toBe(true);
  });
});
