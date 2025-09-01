import * as sdkNode from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createEval2Otel } from '../src/index';

jest.mock('@opentelemetry/sdk-node');

describe('Resource precedence and env', () => {
  beforeEach(() => {
    process.env.OTEL_SERVICE_NAME = 'env-svc';
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS;
  });
  afterEach(() => {
    delete process.env.OTEL_SERVICE_NAME;
  });

  it('uses OTEL_SERVICE_NAME over config.serviceName and sets env headers', () => {
    const startMock = jest.fn();
    const constructed: any[] = [];
    // @ts-ignore
    (sdkNode as any).NodeSDK.mockImplementation((cfg: any) => { constructed.push(cfg); return { start: startMock }; });
    createEval2Otel({ serviceName: 'config-svc', tracesHeaders: { a: 'b' } } as any);
    expect(startMock).toHaveBeenCalled();
    const cfg = constructed[0];
    const resourceAttrs = (cfg.resource as any).attributes || (cfg.resource as any)._attributes || {};
    expect(resourceAttrs[SemanticResourceAttributes.SERVICE_NAME]).toBe('env-svc');
    expect(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS).toContain('a=b');
  });
});

