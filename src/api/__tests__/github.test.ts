import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Load DTU fixtures ─────────────────────────────────────
const FIXTURES = resolve(__dirname, '../../../twins/github/fixtures');
const treeFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'tree.json'), 'utf8'));
const issuesFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'issues.json'), 'utf8'));
const pullsFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'pulls.json'), 'utf8'));
const commitsFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'commits.json'), 'utf8'));
const readmeFixture = JSON.parse(readFileSync(resolve(FIXTURES, 'files/README.md.json'), 'utf8'));

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
    if (url.includes('/pulls?')) return mockFetchSuccess(pullsFixture);
    if (url.includes('/commits?')) return mockFetchSuccess(commitsFixture);
    if (url.includes('/contents/')) return mockFetchSuccess(readmeFixture);
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

// ── Tests ─────────────────────────────────────────────────

describe('fetchTree', () => {
  it('returns all tree items from fixture', async () => {
    const items = await github.fetchTree(source);
    expect(items).toHaveLength(treeFixture.tree.length);
    expect(items[0]).toHaveProperty('path');
    expect(items[0]).toHaveProperty('type');
  });

  it('filters by path prefix when path is provided', async () => {
    const items = await github.fetchTree(source, 'src');
    const expected = treeFixture.tree.filter(
      (i: { path: string }) => i.path.startsWith('src/')
    );
    expect(items).toHaveLength(expected.length);
    expect(items.every((i: { path: string }) => i.path.startsWith('src/'))).toBe(true);
  });
});

describe('fetchIssues', () => {
  it('returns issues excluding PRs (items with pull_request field)', async () => {
    const issues = await github.fetchIssues(source);
    const expectedCount = issuesFixture.filter(
      (i: { pull_request?: unknown }) => !i.pull_request
    ).length;
    expect(issues).toHaveLength(expectedCount);
    // None should have pull_request field
    for (const issue of issues) {
      expect(issue).not.toHaveProperty('pull_request');
    }
  });

  it('paginates — page 2 returns empty so pagination stops', async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/issues?')) {
        callCount++;
        // First page: full fixture (< 100 items → pagination stops)
        return mockFetchSuccess(issuesFixture);
      }
      return mockFetchSuccess([]);
    });

    await github.fetchIssues(source);
    // Since fixture has 65 items (< 100 per_page), only 1 fetch
    expect(callCount).toBe(1);
  });
});

describe('fetchPullRequests', () => {
  it('returns PRs from fixture', async () => {
    const prs = await github.fetchPullRequests(source);
    expect(prs).toHaveLength(pullsFixture.length);
    expect(prs[0]).toHaveProperty('number');
    expect(prs[0]).toHaveProperty('title');
  });
});

describe('fetchCommits', () => {
  it('returns commits from fixture', async () => {
    const commits = await github.fetchCommits(source);
    expect(commits).toHaveLength(commitsFixture.length);
    expect(commits[0]).toHaveProperty('sha');
    expect(commits[0]).toHaveProperty('commit');
    expect(commits[0].commit).toHaveProperty('message');
  });
});

describe('fetchFile', () => {
  it('decodes base64 content from fixture', async () => {
    const content = await github.fetchFile(source, 'README.md');
    // The decoded content should start with the README header
    expect(content).toContain('# kbexplorer');
    expect(content).toContain('Interactive Knowledge Base Explorer');
  });
});

describe('fetchFiles', () => {
  it('fetches multiple files in parallel', async () => {
    const results = await github.fetchFiles(source, ['README.md', 'docs/guide.md']);
    // README.md should succeed
    expect(results.has('README.md')).toBe(true);
    expect(results.get('README.md')).toContain('# kbexplorer');
    // Both paths hit the same fixture (mock routes /contents/ → readme fixture)
    expect(results.size).toBe(2);
  });
});

describe('error handling', () => {
  it('throws RateLimitError on 403 with X-RateLimit-Remaining: 0', async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 3600;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'rate limit exceeded' }),
      text: () => Promise.resolve('rate limit exceeded'),
      headers: new Map([
        ['X-RateLimit-Remaining', '0'],
        ['X-RateLimit-Reset', String(resetTime)],
      ]),
    });

    await expect(github.fetchTree(source)).rejects.toThrow(github.RateLimitError);
  });

  it('throws NotModifiedError on 304 response', async () => {
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
