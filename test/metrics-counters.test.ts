import { metrics as otMetrics } from '@opentelemetry/api';
import { Eval2OtelMetrics } from '../src/metrics';
import { EvalResult } from '../src/types';

describe('Metrics counters and histograms', () => {
  class FakeCounter { public adds: any[] = []; add(value: number, attrs: any) { this.adds.push({ value, attrs }); } }
  class FakeHistogram { public records: any[] = []; record(value: number, attrs: any) { this.records.push({ value, attrs }); } }
  class FakeMeter {
    counters = new Map<string, FakeCounter>();
    histograms = new Map<string, FakeHistogram>();
    createCounter(name: string) { const c = new FakeCounter(); this.counters.set(name, c); return c as any; }
    createHistogram(name: string) { const h = new FakeHistogram(); this.histograms.set(name, h); return h as any; }
  }

  it('creates and uses custom counter and records evaluation metrics', () => {
    const meter = new FakeMeter();
    jest.spyOn(otMetrics, 'getMeter').mockReturnValue(meter as any);
    const m = new Eval2OtelMetrics({ serviceName: 'svc' });

    const cnt = m.createEvalCounter('custom_failures', 'Number of custom failures');
    cnt.add(1, { foo: 'bar' });

    const evalResult: EvalResult = {
      id: 'm2', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: {}, usage: {}, performance: { duration: 1 },
    } as any;
    m.recordEvaluationMetrics(evalResult, { accuracy: 0.9, precision: 0.8 });

    expect(meter.counters.has('eval.custom_failures')).toBe(true);
    expect(meter.counters.get('eval.custom_failures')!.adds[0]).toEqual({ value: 1, attrs: { foo: 'bar' } });
    expect(meter.histograms.has('eval.accuracy')).toBe(true);
    expect(meter.histograms.get('eval.accuracy')!.records[0].value).toBe(0.9);
  });

  it('records eval2otel conversion operational telemetry', () => {
    const meter = new FakeMeter();
    jest.spyOn(otMetrics, 'getMeter').mockReturnValue(meter as any);
    const m = new Eval2OtelMetrics({ serviceName: 'svc' });
    const evalResult: EvalResult = {
      id: 'm3', timestamp: Date.now(), model: 'gpt-4', system: 'openai', operation: 'chat',
      request: { model: 'gpt-4' }, response: {}, usage: {}, performance: { duration: 1 },
    } as any;

    m.recordConversionTelemetry(evalResult, {
      evalId: 'm3',
      success: true,
      contractVersion: 'eval2otel.v1',
      semconvVersion: '1.37.0',
      spanName: 'gen_ai.chat',
      eventCount: 2,
      droppedEventCount: 1,
      redactedContentCount: 1,
      truncatedContentCount: 1,
      warningCount: 0,
      warnings: [],
      durationMs: 12,
    });

    expect(meter.counters.get('eval2otel.conversion.count')!.adds[0].value).toBe(1);
    expect(meter.histograms.get('eval2otel.conversion.duration')!.records[0].value).toBe(12);
    expect(meter.histograms.get('eval2otel.conversion.dropped_event_count')!.records[0].value).toBe(1);
    expect(meter.histograms.get('eval2otel.conversion.redacted_content_count')!.records[0].value).toBe(1);
    expect(meter.histograms.get('eval2otel.conversion.truncated_content_count')!.records[0].value).toBe(1);
  });
});
