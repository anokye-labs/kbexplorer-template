/**
 * Phase 6 / F6 #337 — golden snapshot of the `llm-context` representation.
 *
 * Builds the same local-mode KBGraph as `local-graph.test.ts`, then renders a
 * neighbor-anchored, token-budgeted context pack anchored on a fixed node and
 * diffs it byte-for-byte against the committed golden. The budget is chosen so
 * the pack both expands some neighbors and links others (kg:// navigation),
 * exercising both code paths. Regenerate with `UPDATE_GOLDEN=1`.
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
import { renderLlmContext } from '../../src/representation/targets/llm-context';
import { installWikipediaFetchMock } from './wikipedia-mock';
import { readGolden } from './golden';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(here, 'local-llm-context.golden.md');
const MANIFEST = join(here, 'fixtures', 'manifest.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const ANCHOR = 'issue-147';
const TOKEN_BUDGET = 300;

async function buildLocalGraph() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as RepoManifest;
  const config = buildConfigFromManifest(manifest);
  return buildKnowledgeBaseFromManifest(manifest, config);
}

describe('golden: local-mode llm-context representation (F6 #337)', () => {
  beforeEach(() => {
    installWikipediaFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders byte-for-byte identical to the committed golden fixture', async () => {
    const { graph } = await buildLocalGraph();
    const pack = renderLlmContext(graph, { anchors: [ANCHOR], tokenBudget: TOKEN_BUDGET });
    if (UPDATE) writeFileSync(GOLDEN, pack);
    expect(pack).toBe(readGolden(GOLDEN));
  });

  it('is anchored, budgeted and navigable: never the whole graph', async () => {
    const { graph } = await buildLocalGraph();
    const pack = renderLlmContext(graph, { anchors: [ANCHOR], tokenBudget: TOKEN_BUDGET });
    expect(pack).toContain('## Anchor —');
    expect(pack).toContain('kg://');
    expect(pack).toContain('## Navigate');
    // A neighbor-anchored pack references far fewer nodes than the full graph.
    const referenced = new Set([...pack.matchAll(/kg:\/\/\S+/g)].map(m => m[0]));
    expect(referenced.size).toBeLessThan(graph.nodes.length);
  });

  it('is deterministic: two builds produce identical bytes', async () => {
    const [a, b] = await Promise.all([buildLocalGraph(), buildLocalGraph()]);
    const opts = { anchors: [ANCHOR], tokenBudget: TOKEN_BUDGET };
    expect(renderLlmContext(a.graph, opts)).toBe(renderLlmContext(b.graph, opts));
  });
});
