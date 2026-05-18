import * as fs from 'fs';
import * as path from 'path';
import {
  ATTRIBUTE_REGISTRY,
  assertRegisteredAttributes,
  collectUnknownAttributes,
  isRegisteredAttribute,
} from '../src/semconv';
import { ATTR } from '../src/attributes';

describe('semantic convention registry', () => {
  it('registers eval2otel emitted attributes and extension prefixes', () => {
    expect(isRegisteredAttribute(ATTR.CONTRACT_VERSION)).toBe(true);
    expect(isRegisteredAttribute(ATTR.RAG_MRR)).toBe(true);
    expect(isRegisteredAttribute('gen_ai.provider.name')).toBe(true);
    expect(isRegisteredAttribute('gen_ai.safety.flagged.hate')).toBe(true);
    expect(isRegisteredAttribute('gen_ai.safety.severity.harassment')).toBe(true);
    expect(isRegisteredAttribute('eval.promptfoo.score')).toBe(true);
    expect(isRegisteredAttribute('openai.request_id')).toBe(true);
  });

  it('collects and throws on unknown attributes', () => {
    expect(collectUnknownAttributes({
      [ATTR.PROVIDER_NAME]: 'openai',
      'unowned.attr': true,
    })).toEqual(['unowned.attr']);

    expect(() => assertRegisteredAttributes({
      [ATTR.PROVIDER_NAME]: 'openai',
      'unowned.attr': true,
    })).toThrow('unowned.attr');
  });

  it('keeps the registry itself unique and the conformance fixture expectations registered', () => {
    const keys = ATTRIBUTE_REGISTRY.map(spec => spec.key);
    expect(new Set(keys).size).toBe(keys.length);

    const fixtureDir = path.join(__dirname, 'fixtures', 'conformance');
    for (const file of fs.readdirSync(fixtureDir).filter(name => name.endsWith('.json'))) {
      const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
      const expectedAttrs = [
        fixture.expected?.startAttributes ?? {},
        fixture.expected?.finalAttributes ?? {},
        ...(fixture.expected?.events ?? []).map((event: { attributes?: Record<string, unknown> }) => event.attributes ?? {}),
      ];
      for (const attrs of expectedAttrs) {
        assertRegisteredAttributes(attrs);
      }
    }
  });
});
