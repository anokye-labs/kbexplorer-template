/**
 * Phase 0 / T0.2 — golden snapshot of the remote-mode KBGraph.
 *
 * Builds the KBGraph via the remote (GitHub API) loader, but against recorded
 * fixtures so the test is hermetic — no live network. Both the GitHub REST
 * API and Wikipedia are stubbed at the single `globalThis.fetch` boundary
 * (see `remote-api-fetch-mock.ts`): GitHub endpoints for this fixture's repo
 * are served from `fixtures/remote-api.json`, Wikipedia summaries are served
 * from `fixtures/wikipedia.json`, and any unrecorded URL throws — so no real
 * network can happen and config/provider drift surfaces as a golden diff.
 *
 * anokye-labs/kbexplorer-template#472 (slice 4/5 STEP B): `GitHubApiSource`'s
 * real fetch implementation now lives inside `@anokye-labs/kbexplorer-engine`
 * and calls `globalThis.fetch` directly, so the fixture routing that used to
 * mock `src/api`'s exported functions no longer intercepts anything — this
 * mocks the actual network boundary instead, exercising the REAL ported
 * fetch → decode → parse → graph pipeline end-to-end.
 *
 * Like the local-mode golden, this is a guardrail: a change that alters the
 * remote-built graph must regenerate the fixtures (`npm run golden:update`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SourceConfig } from '../../src/types';
import { installRemoteApiFetchMock, installInMemoryLocalStorage, type RemoteApiFixture } from './remote-api-fetch-mock';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(here, 'remote-graph.golden.json');
const FIXTURE = join(here, 'fixtures', 'remote-api.json');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

interface RemoteFixture extends RemoteApiFixture {
  source: SourceConfig;
}

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as RemoteFixture;

describe('golden: remote-mode KBGraph (hermetic, recorded fixtures)', () => {
  beforeEach(() => {
    installInMemoryLocalStorage();
    installRemoteApiFetchMock(fixture);
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

  it('ingests configured structured content in remote mode', async () => {
    const { loadRemoteKnowledgeBase } = await import('../../src/engine/remote-loader');
    const { graph } = await loadRemoteKnowledgeBase(fixture.source, 'standard');
    const structured = graph.nodes.filter(node => node.provider === 'content-model');
    expect(structured.length).toBeGreaterThan(0);
    expect(structured.some(node => node.source.type === 'structured')).toBe(true);
    expect(structured.some(node =>
      node.source.type === 'structured' &&
      node.sourceFile?.path.startsWith('structured-content/'),
    )).toBe(true);
  });

  it('is hermetic: every network fetch is served from a recording', async () => {
    const fetchSpy = installRemoteApiFetchMock(fixture);
    const { loadRemoteKnowledgeBase } = await import('../../src/engine/remote-loader');
    await loadRemoteKnowledgeBase(fixture.source, 'standard');
    // The mock throws on any unrecorded URL, so reaching here means no real
    // network was attempted. Every call must target either the fixture's
    // GitHub repo or the recorded Wikipedia endpoint.
    const ghPrefix = `https://api.github.com/repos/${fixture.source.owner}/${fixture.source.repo}/`;
    for (const call of fetchSpy.mock.calls) {
      const url = typeof call[0] === 'string' ? call[0] : String(call[0]);
      expect(url.startsWith(ghPrefix) || url.startsWith('https://en.wikipedia.org/')).toBe(true);
    }
  });
});
