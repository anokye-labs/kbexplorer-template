/**
 * Test helper: load the content-model fixture tree from disk into a
 * {@link ContentModelSource}. Lives outside the `*.test.ts` glob so vitest does
 * not treat it as a test file.
 *
 * Kept in template (anokye-labs/kbexplorer-template#472, slice 2/5) even though
 * `content-model/{builder,schema-reader,register}.ts` moved to
 * `@anokye-labs/kbexplorer-engine` — this fixture tree + loader is still needed
 * by template-local pipeline tests (`pipeline-idempotency.test.ts`,
 * `source-edit.test.ts`) that build a real `ContentModelSource` and feed it
 * through the package's `buildContentModel`. Engine has its own independent copy
 * for its own content-model unit tests.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentModelSource } from '@anokye-labs/kbexplorer-engine';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the fixture content-model root. */
export const FIXTURE_ROOT = join(here, 'fixtures', 'content-model');

function walk(dir: string, base: string, out: Record<string, string>): void {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      walk(abs, base, out);
    } else {
      const rel = relative(base, abs).split('\\').join('/');
      out[rel] = readFileSync(abs, 'utf-8');
    }
  }
}

/** Load the full fixture content-model tree as a flat path→content source. */
export function loadFixtureSource(root = FIXTURE_ROOT): ContentModelSource {
  const files: Record<string, string> = {};
  walk(root, root, files);
  return { root: 'content-model', files };
}
