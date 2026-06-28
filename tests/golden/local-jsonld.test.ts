/**
 * Phase 6 / F6 #336 — golden snapshot of the `json-ld` representation.
 *
 * Builds the same local-mode KBGraph as `local-graph.test.ts` (the committed
 * manifest fixture) and renders it through the `json-ld` representation, then
 * diffs byte-for-byte against the committed golden. Any change to the JSON-LD
 * emitter or the graph must regenerate the fixture (`UPDATE_GOLDEN=1`) so the
 * diff is visible in review.
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
import { serializeGraphJsonLd } from '../../src/representation/targets/json-ld';
import { installWikipediaFetchMock } from './wikipedia-mock';
import { readGolden } from './golden';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(here, 'local-jsonld.golden.json');
const MANIFEST = join(here, 'fixtures', 'manifest.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

async function buildLocalGraph() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as RepoManifest;
  const config = buildConfigFromManifest(manifest);
  return buildKnowledgeBaseFromManifest(manifest, config);
}

describe('golden: local-mode json-ld representation (F6 #336)', () => {
  beforeEach(() => {
    installWikipediaFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes byte-for-byte identical to the committed golden fixture', async () => {
    const { graph } = await buildLocalGraph();
    const serialized = serializeGraphJsonLd(graph);
    if (UPDATE) writeFileSync(GOLDEN, serialized);
    expect(serialized).toBe(readGolden(GOLDEN));
  });

  it('is deterministic: two builds produce identical bytes', async () => {
    const [a, b] = await Promise.all([buildLocalGraph(), buildLocalGraph()]);
    expect(serializeGraphJsonLd(a.graph)).toBe(serializeGraphJsonLd(b.graph));
  });
});
