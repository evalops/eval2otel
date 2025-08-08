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
});

