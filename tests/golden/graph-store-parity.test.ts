import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  GraphStore,
  GraphStoreCacheKey,
  GraphStoreEntry,
  GraphStoreInvalidation,
  GraphStoreWrite,
  ProviderResult,
} from '../../src/types';
import {
  buildConfigFromManifest,
  buildKnowledgeBaseFromManifest,
  type RepoManifest,
} from '../../src/engine/local-loader';
import { registerProviders } from '../../src/engine/loader';
import { ManifestSource } from '../../src/engine/sources/manifest-source';
import { formatGraphStoreCacheKey } from '../../src/types';
import { buildProviderResultCacheKey } from '../../src/engine/store/fingerprint';
import { orchestrateWithProviderResultStore } from '../../src/engine/store/store-orchestrator';
import { ProviderRegistry } from '../../src/engine/providers';
import { serializeGraph } from './serialize';
import { installWikipediaFetchMock } from './wikipedia-mock';

const here = dirname(fileURLToPath(import.meta.url));
const MANIFEST = join(here, 'fixtures', 'manifest.json');

function loadManifestFixture(): RepoManifest {
  return JSON.parse(readFileSync(MANIFEST, 'utf8')) as RepoManifest;
}

class MemoryGraphStore implements GraphStore<ProviderResult> {
  entries = new Map<string, GraphStoreEntry<ProviderResult>>();
  getCount = 0;
  putCount = 0;

  async get(key: GraphStoreCacheKey): Promise<GraphStoreEntry<ProviderResult> | undefined> {
    this.getCount++;
    return this.entries.get(formatGraphStoreCacheKey(key));
  }

  async put(entry: GraphStoreWrite<ProviderResult>): Promise<void> {
    this.putCount++;
    this.entries.set(formatGraphStoreCacheKey(entry.key), {
      ...entry,
      createdAt: entry.createdAt ?? 'created',
      updatedAt: entry.updatedAt ?? 'updated',
    });
  }

  async delete(key: GraphStoreCacheKey): Promise<boolean> {
    return this.entries.delete(formatGraphStoreCacheKey(key));
  }

  async invalidate(_match: GraphStoreInvalidation): Promise<number> {
    const count = this.entries.size;
    this.entries.clear();
    return count;
  }
}

async function buildLocalGraphWithStore(store: MemoryGraphStore) {
  const manifest = loadManifestFixture();
  const config = buildConfigFromManifest(manifest);
  const source = new ManifestSource(manifest, config);
  const data = await source.getRepoData();
  const registry = new ProviderRegistry();
  registerProviders(registry, data);
  const graph = await orchestrateWithProviderResultStore(
    registry,
    config,
    { readme: data.readme },
    store,
    (providerId, previousContentHash) =>
      buildProviderResultCacheKey(source, config, data, providerId, previousContentHash),
  );
  return { graph, config };
}

describe('golden: graph-store parity', () => {
  beforeEach(() => {
    installWikipediaFetchMock();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches the default-off local graph byte-for-byte and reuses cache on no-change reload', async () => {
    const manifest = loadManifestFixture();
    const config = buildConfigFromManifest(manifest);
    const baseline = await buildKnowledgeBaseFromManifest(manifest, config);
    const store = new MemoryGraphStore();

    const first = await buildLocalGraphWithStore(store);
    const writesAfterFirst = store.putCount;
    const second = await buildLocalGraphWithStore(store);

    expect(serializeGraph(first.graph)).toBe(serializeGraph(baseline.graph));
    expect(serializeGraph(second.graph)).toBe(serializeGraph(baseline.graph));
    expect(writesAfterFirst).toBeGreaterThan(0);
    expect(store.putCount).toBe(writesAfterFirst);
  });
});
