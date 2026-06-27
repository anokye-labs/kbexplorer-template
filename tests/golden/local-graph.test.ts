/**
 * Phase 0 / T0.1 — golden snapshot of the local-mode KBGraph.
 *
 * Builds the KBGraph via the local loader (the same path the app uses with
 * `VITE_KB_LOCAL=true`, which imports the committed `repo-manifest.json`),
 * serializes it deterministically, and diffs byte-for-byte against the
 * committed golden fixture under `tests/golden/`.
 *
 * This is a guardrail, not a refactor: any change that alters the produced
 * graph must regenerate the fixture (`npm run golden:update`) so the diff is
 * visible in review. The determinism check below proves two builds of the same
 * inputs serialize to identical bytes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadLocalKnowledgeBase } from '../../src/engine/local-loader';
import { serializeGraph } from './serialize';
import { installWikipediaFetchMock } from './wikipedia-mock';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(here, 'local-graph.golden.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

describe('golden: local-mode KBGraph', () => {
  beforeEach(() => {
    installWikipediaFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes byte-for-byte identical to the committed golden fixture', async () => {
    const { graph } = await loadLocalKnowledgeBase();
    const serialized = serializeGraph(graph);
    if (UPDATE) {
      writeFileSync(GOLDEN, serialized);
    }
    const golden = readFileSync(GOLDEN, 'utf8');
    expect(serialized).toBe(golden);
  });

  it('is deterministic: two builds produce identical bytes', async () => {
    const [a, b] = await Promise.all([
      loadLocalKnowledgeBase(),
      loadLocalKnowledgeBase(),
    ]);
    expect(serializeGraph(a.graph)).toBe(serializeGraph(b.graph));
  });
});
