/**
 * GitHub API client for fetching repository content at runtime.
 * Supports two modes:
 *   - authored: fetches markdown files from a content directory
 *   - repo-aware: fetches issues, PRs, README, and file tree
 */
import type { SourceConfig } from '../types';

const CACHE_PREFIX = 'kbe:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 33; // bump to invalidate all cached data (33: Work metadata dates now render in UTC so issue/PR/commit/release nodes are stable across time zones); 32: Feature H (#275) — first-class `service` + `decision` content-model kinds: services-monorepo entities now emit `service` nodes (owned-by → team, tracked-in → system-of-record) and `decision`/ADR nodes (decided-by → person, affects → workstream/mission) with bespoke ServiceView/DecisionView, folding into the `teamops` cluster like the rest of the kg:// spine); 31: sensemaking pass — content-model entities now anchor to repo-meta via inferred `tracked-in` edge AND their cluster folds from `person`/`squad`/`priority`/`workstream`/`cycle`/`mission`/`org`/`team`/`system-of-record` into a single `teamops` cluster so the kg:// spine no longer floats as 2 disconnected islands or fragments the legend into 9 singleton chips); 30: sensemaking pass — issues no longer cluster by per-label (all land in `work`); issues, PRs, commits, branches all carry a typed `tracked-in` edge + `parent` to `repo-meta`; repo-meta links to repo-root with a `contains` edge so the file tree and GitHub repo coexist as one cluster; phantom #NNN cross-references are filtered to known issues/PRs only; 29: person nodes (#235) — GHIssue.user added to the cached issue shape, person nodes derived from work data; 28: release nodes — GHRelease shape added, releases fetched from /repos/{owner}/{repo}/releases, NodeSource union extended with `release`, Work view includes release nodes; 27: content-model nodes carry sourceFile {path,raw,format} for the F5 source-of-truth editor → PR write-back; 26: cross-repo vocabulary/synonym mapping (#153) — alias @type canonicalized to its kind + `jsonld.nativeType` preserving the repo's native term; 25: T5.3 F5 custom JS theme-module loader — config.theme.moduleUrl/moduleThemeName opt into dynamically import()ing a host-provided ESM module that exports a Fluent Theme/BrandVariants, registered into the THEME_MAP, changing the cached config shape; 24: T5.1 F5 external theme file — config.theme.themesFile points at a dedicated host-repo theme file fetched at runtime (and captured in the local manifest as themeFileRaw) and merged into the THEME_MAP, so the cached content shape now includes external-file themes; 23: T5.2 F5 raw CSS override sheet — config.branding.css now records a host-repo CSS path/URL injected as the last <link rel=stylesheet>, changing the cached config shape; 22: T4.2 F4 per-page accent/theme — node frontmatter accent/tokens/theme (KBNode.pageTheme) now restyle individual reading pages via scoped CSS vars, changing the cached render's node shape; 21: T4.1 F4 per-cluster token deltas — config.clusters.<id>.tokens now shift cluster-scoped surfaces (cards/badges/reading header) via scoped CSS vars, affecting cached render; 20: T2.4 F2 config-driven brand — theme cycle + persistence now span config.theme.themes.*; selectable theme set is dynamic (built-ins + config themes) and stored kbe-theme is validated against it, changing the cached render's theme shape; 19: F3 branding.favicon config field swaps document <link rel=icon> at runtime — affects cached render; 18: F3 branding.logo config field renders on HomePage hero + HUD header — affects cached render; 17: F1 config-driven appearance — theme.default initial mode + theme.font.* CSS vars now affect cached render; 16: skill node type — .github/skills/**/SKILL.md → SkillView; 15: F3 structural nodes + node-map JSON-LD merged with content-model spine ingestion; 13: KBNode JSON-LD fields + KBEdge.relation)

// Clear stale cache from older versions
try {
  const storedVersion = localStorage.getItem('kbe:version');
  if (storedVersion !== String(CACHE_VERSION)) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('kbe:version', String(CACHE_VERSION));
  }
} catch { /* localStorage unavailable */ }

interface CacheEntry<T> {
  data: T;
  etag?: string;
  ts: number;
}

function cacheGet<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T, etag?: string): void {
  try {
    const entry: CacheEntry<T> = { data, etag, ts: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — skip silently
  }
}

const GH_API_BASE = import.meta.env.VITE_GH_API_BASE ?? 'https://api.github.com';

async function ghFetch<T>(path: string, etag?: string): Promise<{ data: T; etag?: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const res = await fetch(`${GH_API_BASE}${path}`, { headers });

  if (res.status === 304) {
    throw new NotModifiedError();
  }
  if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
    const reset = res.headers.get('X-RateLimit-Reset');
    throw new RateLimitError(reset ? new Date(Number(reset) * 1000) : undefined);
  }
  if (!res.ok) {
    throw new GitHubApiError(res.status, await res.text());
  }

  return {
    data: (await res.json()) as T,
    etag: res.headers.get('ETag') ?? undefined,
  };
}

export class NotModifiedError extends Error {
  constructor() { super('Not modified'); this.name = 'NotModifiedError'; }
}

export class RateLimitError extends Error {
  resetAt?: Date;
  constructor(resetAt?: Date) {
    super(`GitHub API rate limit exceeded${resetAt ? `. Resets at ${resetAt.toISOString()}` : ''}`);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

export class GitHubApiError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`GitHub API error ${status}: ${body}`);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

// ── GitHub API response types ──────────────────────────────

export interface GHTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GHIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string }>;
  /** The GitHub user who opened the issue (author). */
  user?: { login: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: { url: string };
}

export interface GHFileContent {
  name: string;
  path: string;
  sha: string;
  content: string; // base64 encoded
  encoding: string;
}

// ── Public API ─────────────────────────────────────────────

/** Resolve an image path to a URL — local mode uses Vite dev server, remote uses GitHub. */
export function resolveImageUrl(source: SourceConfig, path: string): string {
  if (import.meta.env.VITE_KB_LOCAL === 'true' || import.meta.env.DEV) {
    return `${import.meta.env.BASE_URL || '/'}${path}`;
  }
  const branch = source.branch ?? 'main';
  if (GH_API_BASE !== 'https://api.github.com') {
    return `${GH_API_BASE}/repos/${source.owner}/${source.repo}/contents/${path}?ref=${branch}`;
  }
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${branch}/${path}`;
}

/** Fetch and decode a single file from the repo. */
export async function fetchFile(source: SourceConfig, path: string): Promise<string> {
  const cacheKey = `file:${source.owner}/${source.repo}:${path}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached.data;

  const branch = source.branch ?? 'main';
  const { data } = await ghFetch<GHFileContent>(
    `/repos/${source.owner}/${source.repo}/contents/${path}?ref=${branch}`
  );

  const binary = atob(data.content);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes);
  cacheSet(cacheKey, decoded, data.sha);
  return decoded;
}

/** List all files in a directory (recursive via Git Trees API). */
export async function fetchTree(source: SourceConfig, path?: string): Promise<GHTreeItem[]> {
  const cacheKey = `tree:${source.owner}/${source.repo}:${path ?? ''}`;
  const cached = cacheGet<GHTreeItem[]>(cacheKey);
  if (cached) return cached.data;

  const branch = source.branch ?? 'main';
  const { data } = await ghFetch<{ tree: GHTreeItem[] }>(
    `/repos/${source.owner}/${source.repo}/git/trees/${branch}?recursive=1`
  );

  const items = path
    ? data.tree.filter(item => item.path.startsWith(path + '/'))
    : data.tree;

  cacheSet(cacheKey, items);
  return items;
}

/** Fetch issues (not PRs) from the repo. */
export async function fetchIssues(source: SourceConfig): Promise<GHIssue[]> {
  const cacheKey = `issues:${source.owner}/${source.repo}`;
  const cached = cacheGet<GHIssue[]>(cacheKey);
  if (cached) return cached.data;

  const allIssues: GHIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await ghFetch<GHIssue[]>(
      `/repos/${source.owner}/${source.repo}/issues?state=all&per_page=${perPage}&page=${page}`
    );
    // Filter out PRs (GitHub API includes PRs in issues endpoint)
    const issues = data.filter(i => !i.pull_request);
    allIssues.push(...issues);
    if (data.length < perPage) break;
    page++;
  }

  cacheSet(cacheKey, allIssues);
  return allIssues;
}

/** Fetch pull requests from the repo. */
export async function fetchPullRequests(source: SourceConfig): Promise<GHIssue[]> {
  const cacheKey = `prs:${source.owner}/${source.repo}`;
  const cached = cacheGet<GHIssue[]>(cacheKey);
  if (cached) return cached.data;

  const allPRs: GHIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await ghFetch<GHIssue[]>(
      `/repos/${source.owner}/${source.repo}/pulls?state=all&per_page=${perPage}&page=${page}`
    );
    allPRs.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  cacheSet(cacheKey, allPRs);
  return allPRs;
}

export interface GHCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
  files?: Array<{ filename: string; status: string }>;
}

/**
 * A GitHub release as returned by the releases API.
 * Drafts are excluded; prerelease flag is preserved.
 */
export interface GHRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
}

/** Fetch recent commits from the repo. */
export async function fetchCommits(source: SourceConfig, count = 30): Promise<GHCommit[]> {
  const cacheKey = `commits:${source.owner}/${source.repo}`;
  const cached = cacheGet<GHCommit[]>(cacheKey);
  if (cached) return cached.data;

  const branch = source.branch ?? 'main';
  const { data } = await ghFetch<GHCommit[]>(
    `/repos/${source.owner}/${source.repo}/commits?sha=${branch}&per_page=${count}`
  );

  cacheSet(cacheKey, data);
  return data;
}

/** Fetch GitHub releases (non-draft, newest-first, capped at 30). */
export async function fetchReleases(source: SourceConfig, limit = 30): Promise<GHRelease[]> {
  const cacheKey = `releases:${source.owner}/${source.repo}`;
  const cached = cacheGet<GHRelease[]>(cacheKey);
  if (cached) return cached.data;

  const { data } = await ghFetch<Array<{
    tag_name: string;
    name: string | null;
    body: string | null;
    html_url: string;
    published_at: string | null;
    prerelease: boolean;
    draft: boolean;
  }>>(`/repos/${source.owner}/${source.repo}/releases?per_page=${limit}`);

  const releases: GHRelease[] = data
    .filter(r => !r.draft)
    .sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime())
    .slice(0, limit)
    .map(r => ({
      tag_name: r.tag_name ?? '',
      name: r.name ?? r.tag_name ?? '',
      body: r.body ?? '',
      html_url: r.html_url ?? '',
      published_at: r.published_at ?? '',
      prerelease: r.prerelease ?? false,
    }));

  cacheSet(cacheKey, releases);
  return releases;
}

/** Fetch multiple files in parallel. */
export async function fetchFiles(
  source: SourceConfig,
  paths: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const settled = await Promise.allSettled(
    paths.map(async path => {
      const content = await fetchFile(source, path);
      return { path, content };
    })
  );
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.set(result.value.path, result.value.content);
    }
  }
  return results;
}
