/**
 * GitHub API client for fetching repository content at runtime.
 * Supports two modes:
 *   - authored: fetches markdown files from a content directory
 *   - repo-aware: fetches issues, PRs, README, and file tree
 */
import type { SourceConfig } from '../types';

const CACHE_PREFIX = 'kbe:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 3; // bump to invalidate all cached data

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

async function ghFetch<T>(path: string, etag?: string): Promise<{ data: T; etag?: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const res = await fetch(`https://api.github.com${path}`, { headers });

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

/** Resolve an image path to a raw.githubusercontent.com URL. */
export function resolveImageUrl(source: SourceConfig, path: string): string {
  const branch = source.branch ?? 'main';
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

  const { data } = await ghFetch<GHIssue[]>(
    `/repos/${source.owner}/${source.repo}/pulls?state=all&per_page=100`
  );

  cacheSet(cacheKey, data);
  return data;
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
