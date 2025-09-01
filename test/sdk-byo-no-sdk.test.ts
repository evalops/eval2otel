import * as sdkNode from '@opentelemetry/sdk-node';
import { createEval2Otel, Eval2Otel } from '../src/index';

jest.mock('@opentelemetry/sdk-node');

describe('SDK BYO and no-SDK modes', () => {
  beforeEach(() => {
    delete process.env.OTEL_SEMCONV_STABILITY_OPT_IN;
    delete (process.env as any).OTEL_SEMCONV_GA_VERSION;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_PROTOCOL;
  });

  it('no-SDK mode does not construct or start NodeSDK but sets envs', () => {
    const ctorSpy = jest.spyOn(sdkNode as any, 'NodeSDK');
    const eval2otel = new Eval2Otel({
      serviceName: 'svc',
      useSdk: false,
      semconvStabilityOptIn: 'genai,stable',
      semconvGaVersion: '1.37.0',
      endpoint: 'http://collector:4317',
      exporterProtocol: 'grpc',
    } as any);
    eval2otel.initialize();
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(process.env.OTEL_SEMCONV_STABILITY_OPT_IN).toBe('genai,stable');
    expect((process.env as any).OTEL_SEMCONV_GA_VERSION).toBe('1.37.0');
    expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://collector:4317');
    expect(process.env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('grpc');
  });

  it('BYO SDK with manageSdkLifecycle=false does not start/shutdown', async () => {
    const start = jest.fn();
    const shutdown = jest.fn();
    const sdk = { start, shutdown } as any;
    const eval2otel = createEval2Otel({ serviceName: 'svc', sdk, manageSdkLifecycle: false } as any);
    // initialize called in createEval2Otel
    expect(start).not.toHaveBeenCalled();
    await eval2otel.shutdown();
    expect(shutdown).not.toHaveBeenCalled();
  });
});

