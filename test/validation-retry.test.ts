import { z } from 'zod';
import { Eval2OtelValidation } from '../src/validation';

describe('Validation retry logic', () => {
  it('retries and succeeds with corrected data', async () => {
    const validator = new Eval2OtelValidation({ maxRetries: 3, backoffMs: 1 });
    const schema = z.object({ n: z.number() });
    let attemptCount = 0;

    const result = await validator.validateWithRetry(schema, { n: 'x' }, async () => {
      attemptCount++;
      return { n: 42 };
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.data?.n).toBe(42);
    expect(attemptCount).toBe(1);
  });

  it('fails after max retries with errors', async () => {
    const validator = new Eval2OtelValidation({ maxRetries: 2, backoffMs: 1 });
    const schema = z.object({ ok: z.boolean() });

    const result = await validator.validateWithRetry(schema, { ok: 'nope' }, async () => ({ ok: 'still-nope' } as any));
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.errors).toBeDefined();
  });
});

