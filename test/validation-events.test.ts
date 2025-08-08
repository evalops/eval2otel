import { z } from 'zod';
import { Eval2OtelValidation } from '../src/validation';

describe('Validation addValidationEvents', () => {
  function createMockSpan() {
    const events: { name: string; attributes: Record<string, unknown> }[] = [];
    return {
      addEvent: (name: string, attributes: Record<string, unknown>) => {
        events.push({ name, attributes });
      },
      getEvents: () => events,
    } as any; // Cast as Span for testing
  }

  it('emits success event when validation succeeds', () => {
    const validator = new Eval2OtelValidation({ captureErrors: true });
    const span = createMockSpan();
    const result = { success: true, data: { ok: true }, attempts: 1, duration: 10 };

    validator.addValidationEvents(span, 'test_schema', result);

    const events = span.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].name).toBe('gen_ai.validation.success');
    expect(events[0].attributes['validation.schema']).toBe('test_schema');
    expect(events[0].attributes['validation.attempts']).toBe(1);
    expect(events[0].attributes['validation.duration']).toBe(10);
  });

  it('emits failed and error details when captureErrors is true', () => {
    const validator = new Eval2OtelValidation({ captureErrors: true });
    const span = createMockSpan();
    const schema = z.object({ id: z.string() });
    let zerr: z.ZodError | undefined;
    try {
      schema.parse({ id: 123 });
    } catch (e) {
      if (e instanceof z.ZodError) zerr = e;
    }
    const result = { success: false, errors: zerr!, attempts: 2, duration: 50 };

    validator.addValidationEvents(span, 'test_schema', result);

    const events = span.getEvents();
    expect(events.map((e: any) => e.name)).toEqual([
      'gen_ai.validation.failed',
      'gen_ai.validation.errors',
    ]);
    expect(events[0].attributes['validation.schema']).toBe('test_schema');
    expect(events[0].attributes['validation.error_count']).toBeGreaterThan(0);
    expect(typeof events[1].attributes['validation.errors']).toBe('string');
  });

  it('emits only failed event when captureErrors is false', () => {
    const validator = new Eval2OtelValidation({ captureErrors: false });
    const span = createMockSpan();
    const schema = z.object({ id: z.string() });
    let zerr: z.ZodError | undefined;
    try {
      schema.parse({ id: 123 });
    } catch (e) {
      if (e instanceof z.ZodError) zerr = e;
    }
    const result = { success: false, errors: zerr!, attempts: 1, duration: 5 };

    validator.addValidationEvents(span, 'test_schema', result);

    const events = span.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].name).toBe('gen_ai.validation.failed');
  });
});

