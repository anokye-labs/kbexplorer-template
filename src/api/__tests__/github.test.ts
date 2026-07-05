import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `src/api/github.ts` test suite (anokye-labs/kbexplorer-template#472,
 * slice 4/5 STEP B).
 *
 * The 7 fetch functions' fetch/parse/error-path behavior now lives in
 * `@anokye-labs/kbexplorer-engine` and is covered by its own ported test
 * suite — this file keeps only a couple of re-export smoke tests for that,
 * plus the template-side concerns that live in THIS file: the
 * `localStorageCacheStore` adapter's TTL/version behavior, and (new
 * coverage) that injecting the adapter at a call site actually causes a
 * cache hit to skip the underlying fetch.
 */

// ── Load DTU fixtures ─────────────────────────────────────
const FIXTURES = resolve(__dirname, '../../../twins/github/fixtures');
const treeFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'tree.json'), 'utf8'));
const issuesFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'issues.json'), 'utf8'));

// ── Mock localStorage ─────────────────────────────────────
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  get length() { return mockStorage.size; },
  key: (i: number) => [...mockStorage.keys()][i] ?? null,
  clear: () => mockStorage.clear(),
});

// ── Set env before module import ──────────────────────────
vi.stubEnv('VITE_GH_API_BASE', 'https://api.github.com');

// ── Mock fetch ────────────────────────────────────────────
function mockFetchSuccess(body: unknown, headers: Record<string, string> = {}) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Map(Object.entries(headers)),
  });
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Route fetch calls to the right fixture based on URL path
function setupFetchRouter() {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes('/git/trees/')) return mockFetchSuccess(treeFixture);
    if (url.includes('/issues?')) return mockFetchSuccess(issuesFixture);
    return mockFetchSuccess([]);
  });
}

// ── Source config used across tests ───────────────────────
const source = { owner: 'anokye-labs', repo: 'kbexplorer-template', branch: 'main' };

// ── Import the module under test (after mocks are set up) ─
let github: typeof import('../github');

beforeEach(async () => {
  mockStorage.clear();
  fetchMock.mockReset();
  setupFetchRouter();
  // Dynamic import to ensure mocks are in place, and get a fresh module
  // so top-level cache-version logic runs against clean localStorage
  github = await import('../github');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Re-export smoke tests ─────────────────────────────────
// The 7 fetch functions + error classes are re-exported from
// `@anokye-labs/kbexplorer-engine/sources` — their own fetch/parse/
// error-path behavior is exercised by the engine's own test suite. These
// smoke tests just confirm the re-export resolves and is callable.
describe('github.ts re-exports the engine GitHub client', () => {
  it('fetchTree resolves through the re-export', async () => {
    const items = await github.fetchTree(source);
    expect(items).toHaveLength(treeFixture.tree.length);
    expect(items[0]).toHaveProperty('path');
  });

  it('re-exported error classes are thrown correctly', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 304,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(''),
      headers: new Map(),
    });
    await expect(github.fetchTree(source)).rejects.toThrow(github.NotModifiedError);
  });
});

// ── localStorageCacheStore adapter behavior (template-side, STEP B) ───
describe('localStorageCacheStore', () => {
  it('returns a previously set value', () => {
    github.localStorageCacheStore.set('test-key', { hello: 'world' });
    expect(github.localStorageCacheStore.get('test-key')).toEqual({ hello: 'world' });
  });

  it('returns undefined for a key that was never set', () => {
    expect(github.localStorageCacheStore.get('missing-key')).toBeUndefined();
  });

  it('expires entries older than the 5-minute TTL', () => {
    vi.useFakeTimers();
    try {
      github.localStorageCacheStore.set('ttl-key', 'value');
      vi.advanceTimersByTime(6 * 60 * 1000); // > CACHE_TTL_MS
      expect(github.localStorageCacheStore.get('ttl-key')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── New coverage (STEP B): injected cache skips a redundant fetch ─────
describe('localStorageCacheStore injection prevents a redundant fetch', () => {
  it('a TTL-fresh cache hit does NOT call the engine fetch a second time', async () => {
    // First call: cache miss — hits the (mocked) network once and populates
    // the adapter via the engine fetch fn's own cache?.set() call.
    const first = await github.fetchIssues(source, undefined, github.localStorageCacheStore);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call with the same adapter: cache hit — the engine fetch fn's
    // own cache?.get() short-circuits before any network call.
    const second = await github.fetchIssues(source, undefined, github.localStorageCacheStore);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('without an injected cache, every call hits the network', async () => {
    await github.fetchIssues(source);
    await github.fetchIssues(source);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
