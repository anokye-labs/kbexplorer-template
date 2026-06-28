/**
 * Phase 0 / T0.1 — golden snapshot of the local-mode KBGraph.
 *
 * Builds the KBGraph via the local loader's pure builder
 * (`buildKnowledgeBaseFromManifest`) fed a committed manifest fixture
 * (`fixtures/manifest.json`) — the same transform the app runs with
 * `VITE_KB_LOCAL=true`, minus the ambient/gitignored generated manifest so the
 * snapshot is hermetic and stable in CI. Serializes deterministically and
 * diffs byte-for-byte against the committed golden fixture under `tests/golden/`.
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
import {
  buildConfigFromManifest,
  buildKnowledgeBaseFromManifest,
  type RepoManifest,
} from '../../src/engine/local-loader';
import { serializeGraph } from './serialize';
import { installWikipediaFetchMock } from './wikipedia-mock';
import { readGolden } from './golden';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(here, 'local-graph.golden.json');
const MANIFEST = join(here, 'fixtures', 'manifest.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

function loadManifestFixture(): RepoManifest {
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as RepoManifest;
}

async function buildLocalGraph() {
  const manifest = loadManifestFixture();
  const config = buildConfigFromManifest(manifest);
  return buildKnowledgeBaseFromManifest(manifest, config);
}

describe('golden: local-mode KBGraph', () => {
  beforeEach(() => {
    installWikipediaFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes byte-for-byte identical to the committed golden fixture', async () => {
    const { graph } = await buildLocalGraph();
    const serialized = serializeGraph(graph);
    if (UPDATE) {
      writeFileSync(GOLDEN, serialized);
    }
    const golden = readGolden(GOLDEN);
    expect(serialized).toBe(golden);
  });

  it('is deterministic: two builds produce identical bytes', async () => {
    const [a, b] = await Promise.all([
      buildLocalGraph(),
      buildLocalGraph(),
    ]);
    expect(serializeGraph(a.graph)).toBe(serializeGraph(b.graph));
  });
});
