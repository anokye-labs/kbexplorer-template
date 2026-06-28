import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Phase 6 / F6 #334 purity guard.
 *
 * A representation consumes the **pure** `KBGraph`; it must never reach back
 * into the engine/loader to refetch a system of record. The pure-string targets
 * (`json-ld`, `llm-context`) and the registry enforce this statically: any
 * `from '../../engine...'` (or a loader import) in their source fails the build.
 *
 * The `spa` target is intentionally exempt — it IS the website and composes the
 * app's view components; it still receives an already-built graph and does not
 * import the loader.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const PURE_TARGETS = {
  'json-ld.ts': read('../json-ld.ts'),
  'llm-context.ts': read('../llm-context.ts'),
  'registry.ts': read('../../registry.ts'),
  'urn.ts': read('../urn.ts'),
};

describe('representation targets are engine-free (F6 #334)', () => {
  for (const [name, source] of Object.entries(PURE_TARGETS)) {
    it(`${name} has zero import specifiers that resolve into the engine`, () => {
      const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
        m => m[1],
      );
      const engineSpecifiers = specifiers.filter(
        spec => /(^|\/)engine(\/|$)/.test(spec) || /loader/.test(spec),
      );
      expect(engineSpecifiers).toEqual([]);
    });

    it(`${name} does not reach the engine via dynamic import or require`, () => {
      expect(/import\(\s*['"][^'"]*engine[^'"]*['"]\s*\)/.test(source)).toBe(false);
      expect(/require\(\s*['"][^'"]*engine[^'"]*['"]\s*\)/.test(source)).toBe(false);
    });
  }
});
