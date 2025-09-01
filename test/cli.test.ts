import * as fs from 'fs';
import * as path from 'path';

describe('CLI ingest', () => {
  const tmpDir = path.join(__dirname, 'tmp');
  const file = path.join(tmpDir, 'cli.jsonl');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const eval1 = {
      id: 'e1', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: {}, usage: {}, performance: { duration: 1 },
    };
    const eval2 = {
      id: 'e2', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: {}, usage: {}, performance: { duration: 1 },
    };
    fs.writeFileSync(file, JSON.stringify(eval1) + '\n' + JSON.stringify(eval2) + '\n');
  });

  afterAll(() => {
    try { fs.unlinkSync(file); } catch {}
    try { fs.rmdirSync(tmpDir); } catch {}
  });

  it('runs dry-run without emitting telemetry', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });

    jest.doMock('../src/index', () => ({
      createEval2Otel,
    }));

    const { runCli } = await import('../src/cli');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--dry-run']);

    expect(createEval2Otel).toHaveBeenCalled();
    expect(processEvaluation).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Processed 2 evaluations (dry-run)');
    logSpy.mockRestore();
  });

  it('emits telemetry for each line and shuts down', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });

    jest.doMock('../src/index', () => ({
      createEval2Otel,
    }));

    const { runCli } = await import('../src/cli');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--service-name', 'svc']);

    expect(createEval2Otel).toHaveBeenCalledWith(expect.objectContaining({ serviceName: 'svc' }));
    expect(processEvaluation).toHaveBeenCalledTimes(2);
    expect(shutdown).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Processed 2 evaluations');
    logSpy.mockRestore();
  });

  it('applies provider override before emitting', async () => {
    jest.resetModules();
    const processEvaluation = jest.fn();
    const shutdown = jest.fn();
    const createEval2Otel = jest.fn().mockReturnValue({ processEvaluation, shutdown });
    jest.doMock('../src/index', () => ({ createEval2Otel }));
    const { runCli } = await import('../src/cli');
    await runCli(['node', 'eval2otel-cli', 'ingest', '--file', file, '--provider-override', 'azure.openai']);
    expect(processEvaluation).toHaveBeenCalled();
    const firstArg = processEvaluation.mock.calls[0][0];
    expect(firstArg.system).toBe('azure.openai');
  });
});
