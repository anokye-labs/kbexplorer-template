import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Phase 2 / T2.3 (#312) purity guard.
 *
 * The pure data contract `src/types/index.ts` must import nothing from the
 * engine at load. Styling, graph-layer projection and view definitions moved to
 * `src/representation/*` (which may consult the engine) so that other
 * representation targets (json-ld, llm-context) can consume `KBGraph` as pure
 * data without pulling engine machinery in transitively.
 *
 * This asserts statically against the source's own import/export specifiers —
 * any `from '../engine...'` (or deeper) in `types/index.ts` fails the build.
 */
const typesSource = readFileSync(
  fileURLToPath(new URL('../index.ts', import.meta.url)),
  'utf8',
);

describe('types/index.ts engine-free at load (T2.3 #312)', () => {
  it('has zero import/export specifiers that resolve into the engine', () => {
    const engineSpecifiers = [...typesSource.matchAll(/from\s+['"]([^'"]+)['"]/g)]
      .map(m => m[1])
      .filter(spec => /(^|\/)\.\.\/engine(\/|$)/.test(spec) || /engine\//.test(spec));
    expect(engineSpecifiers).toEqual([]);
  });

  it('does not reference engine modules via dynamic import or require', () => {
    expect(/import\(\s*['"][^'"]*engine[^'"]*['"]\s*\)/.test(typesSource)).toBe(false);
    expect(/require\(\s*['"][^'"]*engine[^'"]*['"]\s*\)/.test(typesSource)).toBe(false);
  });
});
