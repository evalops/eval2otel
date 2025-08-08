import { NodeSDK } from '@opentelemetry/sdk-node';
import * as sdkNode from '@opentelemetry/sdk-node';
import { createEval2Otel } from '../src/index';

jest.mock('@opentelemetry/sdk-node');

describe('SDK initialization', () => {
  it('sets OTLP env based on config and merges default resource', () => {
    const startMock = jest.fn();
    // @ts-ignore mock constructor
    (sdkNode as any).NodeSDK.mockImplementation((cfg: any) => {
      // Ensure resource exists and has merge result
      expect(cfg.resource).toBeDefined();
      return { start: startMock };
    });

    const eval2otel = createEval2Otel({
      serviceName: 'svc',
      endpoint: 'http://collector:4318',
      exporterProtocol: 'http/protobuf',
      exporterHeaders: { Authorization: 'Bearer token' },
    });
    expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://collector:4318');
    expect(process.env.OTEL_EXPORTER_OTLP_PROTOCOL).toBe('http/protobuf');
    expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toContain('Authorization=Bearer token');

    // Start gets called during createEval2Otel.initialize()
    expect(startMock).toHaveBeenCalled();
  });

  it('sets signal-specific endpoints and headers when provided', () => {
    const startMock = jest.fn();
    // @ts-ignore mock constructor
    (sdkNode as any).NodeSDK.mockImplementation(() => ({ start: startMock }));

    const eval2otel = createEval2Otel({
      serviceName: 'svc',
      endpoint: 'http://collector:4318',
      tracesEndpoint: 'http://collector:4318/v1/traces',
      metricsEndpoint: 'http://collector:4318/v1/metrics',
      logsEndpoint: 'http://collector:4318/v1/logs',
      tracesHeaders: { 'x-trace': 't' },
      metricsHeaders: { 'x-metric': 'm' },
      logsHeaders: { 'x-log': 'l' },
    });

    expect(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT).toBe('http://collector:4318/v1/traces');
    expect(process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT).toBe('http://collector:4318/v1/metrics');
    expect(process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT).toBe('http://collector:4318/v1/logs');
    expect(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS).toContain('x-trace=t');
    expect(process.env.OTEL_EXPORTER_OTLP_METRICS_HEADERS).toContain('x-metric=m');
    expect(process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS).toContain('x-log=l');
    expect(startMock).toHaveBeenCalled();
  });
});
