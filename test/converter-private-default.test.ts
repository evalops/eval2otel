import { Eval2OtelConverter } from '../src/converter';

describe('Private default span name branch', () => {
  it('getOperationSpanName returns gen_ai.operation for unknown', () => {
    const conv: any = new Eval2OtelConverter({ serviceName: 'svc' } as any);
    const name = conv.getOperationSpanName('unknown_thing');
    expect(name).toBe('gen_ai.operation');
  });
});

