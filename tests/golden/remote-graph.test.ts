/**
 * Phase 0 / T0.2 — golden snapshot of the remote-mode KBGraph.
 *
 * Builds the KBGraph via the remote (GitHub API) loader, but against recorded
 * fixtures so the test is hermetic — no live network:
 *  - `src/api`'s fetch functions are mocked to serve from `fixtures/remote-api.json`
 *    (derived from the committed manifest); every other export is preserved.
 *  - `globalThis.fetch` is mocked to replay recorded Wikipedia summaries
 *    (`fixtures/wikipedia.json`); any unrecorded URL throws, so no real network
 *    can happen and config/provider drift surfaces as a golden diff.
 *
 * Like the local-mode golden, this is a guardrail: a change that alters the
 * remote-built graph must regenerate the fixtures (`npm run golden:update`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SourceConfig } from '../../src/types';
import { installWikipediaFetchMock } from './wikipedia-mock';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(here, 'remote-graph.golden.json');
const FIXTURE = join(here, 'fixtures', 'remote-api.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

interface RemoteFixture {
  source: SourceConfig;
  issues: unknown[];
  pullRequests: unknown[];
  commits: unknown[];
  releases: unknown[];
  tree: Array<{ path: string; type: string; size?: number }>;
  files: Record<string, string>;
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as RemoteFixture;

// Mock the GitHub API surface: serve recorded responses, preserve every other
// export (resolveImageUrl, error classes, …) so unrelated consumers still work.
vi.mock('../../src/api', async (importActual) => {
  const actual = await importActual<typeof import('../../src/api')>();
  return {
    ...actual,
    fetchIssues: vi.fn(async () => fixture.issues),
    fetchPullRequests: vi.fn(async () => fixture.pullRequests),
    fetchCommits: vi.fn(async () => fixture.commits),
    fetchReleases: vi.fn(async () => fixture.releases),
    fetchTree: vi.fn(async (_source: SourceConfig, path?: string) => {
      if (!path) return fixture.tree;
      const prefix = `${path}/`;
      return fixture.tree.filter((item) => item.path.startsWith(prefix));
    }),
    fetchFile: vi.fn(async (_source: SourceConfig, path: string) => {
      const content = fixture.files[path];
      if (content === undefined) throw new Error(`fixture: no file ${path}`);
      return content;
    }),
    fetchFiles: vi.fn(async (_source: SourceConfig, paths: string[]) => {
      const out = new Map<string, string>();
      for (const p of paths) {
        const content = fixture.files[p];
        if (content !== undefined) out.set(p, content);
      }
      return out;
    }),
  };
});

describe('golden: remote-mode KBGraph (hermetic, recorded fixtures)', () => {
  beforeEach(() => {
    installWikipediaFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes byte-for-byte identical to the committed golden fixture', async () => {
    const { loadRemoteKnowledgeBase } = await import('../../src/engine/remote-loader');
    const { normalizeGoldenText, serializeGraph } = await import('./serialize');
    const { graph } = await loadRemoteKnowledgeBase(fixture.source, 'standard');
    const serialized = serializeGraph(graph);
    if (UPDATE) {
      writeFileSync(GOLDEN, serialized);
    }
    const golden = normalizeGoldenText(readFileSync(GOLDEN, 'utf8'));
    expect(serialized).toBe(golden);
  });

  it('is hermetic: every network fetch is served from a recording', async () => {
    const fetchSpy = installWikipediaFetchMock();
    const { loadRemoteKnowledgeBase } = await import('../../src/engine/remote-loader');
    await loadRemoteKnowledgeBase(fixture.source, 'standard');
    // The mock throws on any unrecorded URL, so reaching here means no real
    // network was attempted. Every call must target the wikipedia endpoint.
    for (const call of fetchSpy.mock.calls) {
      const url = typeof call[0] === 'string' ? call[0] : String(call[0]);
      expect(url.startsWith('https://en.wikipedia.org/')).toBe(true);
    }
  });
});
