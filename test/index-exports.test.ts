import * as pkg from '../src';

describe('Package exports', () => {
  it('exports ATTR and core classes', () => {
    expect(pkg.ATTR).toBeDefined();
    expect(pkg.createEval2Otel).toBeDefined();
    expect(pkg.Eval2OtelConverter).toBeDefined();
    expect(pkg.Eval2OtelMetrics).toBeDefined();
  });
});

