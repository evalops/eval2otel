import * as fs from 'fs';
import * as path from 'path';
import { Span, trace } from '@opentelemetry/api';
import { Eval2OtelConverter } from '../src/converter';
import { EvalResult, OtelConfig } from '../src/types';

class CapturingSpan implements Span {
  events: Array<{ name: string; attributes: Record<string, unknown> }> = [];
  attributes: Record<string, unknown> = {};

  addEvent(name: string, attributesOrStartTime?: unknown) {
    const attrs = typeof attributesOrStartTime === 'object' && attributesOrStartTime !== null
      ? attributesOrStartTime as Record<string, unknown>
      : {};
    this.events.push({ name, attributes: attrs });
    return this;
  }
  setStatus() { return this; }
  setAttribute(key: string, value: unknown) { this.attributes[key] = value; return this; }
  setAttributes(attrs: Record<string, unknown>) { Object.assign(this.attributes, attrs); return this; }
  addLink() { return this; }
  addLinks() { return this; }
  recordException() { return this; }
  end() {}
  spanContext(): any { return {}; }
  isRecording(): boolean { return true; }
  updateName(): this { return this; }
}

class CapturingTracer {
  started: Array<{ name: string; options: any; span: CapturingSpan }> = [];

  startSpan(name: string, options: any) {
    const span = new CapturingSpan();
    this.started.push({ name, options, span });
    return span as any;
  }
}

interface ConformanceFixture {
  name: string;
  config?: Partial<OtelConfig>;
  redactPattern?: string;
  redactMode?: 'replace' | 'null';
  evalResult: EvalResult;
  expected: {
    spanName: string;
    startAttributes?: Record<string, unknown>;
    finalAttributes?: Record<string, unknown>;
    events: Array<{
      name: string;
      attributes?: Record<string, unknown>;
      absentAttributes?: string[];
      forbiddenContent?: string;
    }>;
  };
}

function loadFixtures(): ConformanceFixture[] {
  const dir = path.join(__dirname, 'fixtures', 'conformance');
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as ConformanceFixture);
}

describe('eval2otel conformance contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(loadFixtures())('$name', fixture => {
    const tracer = new CapturingTracer();
    jest.spyOn(trace, 'getTracer').mockReturnValue(tracer as any);
    const config: OtelConfig = {
      serviceName: 'contract-test',
      captureContent: false,
      useSdk: false,
      ...fixture.config,
      redact: fixture.redactPattern
        ? (content: string) => {
          const pattern = new RegExp(fixture.redactPattern!, 'g');
          if (!pattern.test(content)) return content;
          return fixture.redactMode === 'null' ? null : content.replace(pattern, '[REDACTED]');
        }
        : undefined,
    };

    const converter = new Eval2OtelConverter(config);
    const report = converter.convertEvalResult(fixture.evalResult);
    const started = tracer.started[0];

    expect(started.name).toBe(fixture.expected.spanName);
    expect(report.spanName).toBe(fixture.expected.spanName);
    expect(report.success).toBe(true);
    expect(report.eventCount).toBe(fixture.expected.events.length);
    expect(started.options.attributes).toEqual(expect.objectContaining(fixture.expected.startAttributes ?? {}));
    expect(started.span.attributes).toEqual(expect.objectContaining(fixture.expected.finalAttributes ?? {}));
    expect(started.span.events.map(event => event.name)).toEqual(fixture.expected.events.map(event => event.name));

    fixture.expected.events.forEach((expectedEvent, index) => {
      const actual = started.span.events[index];
      expect(actual.attributes).toEqual(expect.objectContaining(expectedEvent.attributes ?? {}));
      (expectedEvent.absentAttributes ?? []).forEach(key => {
        expect(actual.attributes).not.toHaveProperty(key);
      });
      if (expectedEvent.forbiddenContent) {
        expect(JSON.stringify(actual.attributes)).not.toContain(expectedEvent.forbiddenContent);
      }
    });
  });
});
