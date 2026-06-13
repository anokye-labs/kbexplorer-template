import { describe, it, expect } from 'vitest';
import {
  translateQuery,
  parseRoute,
  translatePath,
  normalizeIssue,
  normalizeRelease,
  paginate,
  buildLinkHeader,
  computeEtag,
  createGiteaHandler,
  GITEA_PAGE_CAP,
} from '../adapter.mjs';

describe('translateQuery', () => {
  it('maps per_page → limit and recursive=1 → true', () => {
    const out = translateQuery('per_page=100&recursive=1');
    expect(out.get('limit')).toBe('100');
    expect(out.get('recursive')).toBe('true');
    expect(out.get('per_page')).toBeNull();
  });

  it('passes through state/sha/ref/page unchanged', () => {
    const out = translateQuery('state=all&sha=main&ref=main&page=2');
    expect(out.get('state')).toBe('all');
    expect(out.get('sha')).toBe('main');
    expect(out.get('ref')).toBe('main');
    expect(out.get('page')).toBe('2');
  });

  it('drops pagination params when requested', () => {
    const out = translateQuery('per_page=100&page=3&state=open', { dropPagination: true });
    expect(out.get('limit')).toBeNull();
    expect(out.get('page')).toBeNull();
    expect(out.get('state')).toBe('open');
  });
});

describe('parseRoute', () => {
  it('recognises every supported GitHub resource', () => {
    expect(parseRoute('/repos/o/r/git/trees/main')).toMatchObject({ kind: 'trees', owner: 'o', repo: 'r', ref: 'main' });
    expect(parseRoute('/repos/o/r/contents/content-model/people/ada.yaml')).toMatchObject({ kind: 'contents', path: 'content-model/people/ada.yaml' });
    expect(parseRoute('/repos/o/r/issues')).toMatchObject({ kind: 'issues' });
    expect(parseRoute('/repos/o/r/pulls')).toMatchObject({ kind: 'pulls' });
    expect(parseRoute('/repos/o/r/commits')).toMatchObject({ kind: 'commits' });
    expect(parseRoute('/repos/o/r/releases')).toMatchObject({ kind: 'releases', owner: 'o', repo: 'r' });
    expect(parseRoute('/repos/o/r/releases/')).toMatchObject({ kind: 'releases', owner: 'o', repo: 'r' });
  });

  it('decodes a URL-encoded tree ref', () => {
    expect(parseRoute('/repos/o/r/git/trees/feature%2Fx')).toMatchObject({ kind: 'trees', ref: 'feature/x' });
  });

  it('returns null for unsupported paths', () => {
    expect(parseRoute('/user')).toBeNull();
    expect(parseRoute('/repos/o/r')).toBeNull();
  });
});

describe('translatePath', () => {
  it('builds /api/v1 upstream URLs', () => {
    expect(translatePath({ kind: 'trees', owner: 'o', repo: 'r', ref: 'main' })).toBe('/api/v1/repos/o/r/git/trees/main');
    expect(translatePath({ kind: 'contents', owner: 'o', repo: 'r', path: 'a/b.yaml' })).toBe('/api/v1/repos/o/r/contents/a/b.yaml');
    expect(translatePath({ kind: 'issues', owner: 'o', repo: 'r' })).toBe('/api/v1/repos/o/r/issues');
    expect(translatePath({ kind: 'pulls', owner: 'o', repo: 'r' })).toBe('/api/v1/repos/o/r/pulls');
    expect(translatePath({ kind: 'commits', owner: 'o', repo: 'r' })).toBe('/api/v1/repos/o/r/commits');
    expect(translatePath({ kind: 'releases', owner: 'o', repo: 'r' })).toBe('/api/v1/repos/o/r/releases');
  });
});

describe('normalizeRelease', () => {
  it('maps Gitea created_at → GitHub published_at', () => {
    const ts = '2026-01-15T10:00:00Z';
    const norm = normalizeRelease({ tag_name: 'v1.0', name: 'Release 1.0', body: 'notes', html_url: 'https://x', created_at: ts, is_prerelease: false, is_draft: false });
    expect(norm.published_at).toBe(ts);
    expect(norm.prerelease).toBe(false);
    expect(norm.draft).toBe(false);
    expect(norm.tag_name).toBe('v1.0');
    expect(norm.name).toBe('Release 1.0');
  });

  it('prefers published_at over created_at when both present', () => {
    const norm = normalizeRelease({ tag_name: 'v2', published_at: '2026-02-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', is_prerelease: false, is_draft: false });
    expect(norm.published_at).toBe('2026-02-01T00:00:00Z');
  });

  it('normalises Gitea is_prerelease boolean to prerelease', () => {
    const norm = normalizeRelease({ tag_name: 'v0.1-beta', is_prerelease: true, is_draft: false });
    expect(norm.prerelease).toBe(true);
  });

  it('defaults missing fields to empty strings / false', () => {
    const norm = normalizeRelease({ tag_name: 'v3' });
    expect(norm.name).toBe('v3');
    expect(norm.body).toBe('');
    expect(norm.html_url).toBe('');
    expect(norm.published_at).toBe('');
    expect(norm.prerelease).toBe(false);
    expect(norm.draft).toBe(false);
  });
});

describe('normalizeIssue', () => {
  it('coerces Gitea assignees:null to GitHub []', () => {
    const norm = normalizeIssue({ number: 1, assignees: null, labels: null, pull_request: null });
    expect(norm.assignees).toEqual([]);
    expect(norm.labels).toEqual([]);
  });

  it('preserves the pull_request marker so the app can filter PRs out of issues', () => {
    const pr = normalizeIssue({ number: 2, assignees: [], pull_request: { merged: false } });
    expect(pr.pull_request).toEqual({ merged: false });
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 60 }, (_, i) => i);
  it('slices page 1 and reports a next page', () => {
    const { slice, hasNext } = paginate(items, 1, 50);
    expect(slice).toHaveLength(50);
    expect(hasNext).toBe(true);
  });
  it('slices the final page with no next', () => {
    const { slice, hasNext } = paginate(items, 2, 50);
    expect(slice).toHaveLength(10);
    expect(hasNext).toBe(false);
  });
  it('returns [] past the end (GitHub semantics)', () => {
    const { slice, hasNext } = paginate(items, 2, 100);
    expect(slice).toEqual([]);
    expect(hasNext).toBe(false);
  });
});

describe('buildLinkHeader', () => {
  it('is absent when there is no next page', () => {
    expect(buildLinkHeader('http://localhost:3456', '/repos/o/r/issues', 1, 100, false)).toBeUndefined();
  });
  it('advertises the next page when present', () => {
    const link = buildLinkHeader('http://localhost:3456', '/repos/o/r/issues', 1, 30, true);
    expect(link).toBe('<http://localhost:3456/repos/o/r/issues?per_page=30&page=2>; rel="next"');
  });
});

describe('computeEtag', () => {
  it('is a stable, quoted sha1 that changes with the body', () => {
    const a = computeEtag('hello');
    expect(a).toMatch(/^"[0-9a-f]{40}"$/);
    expect(computeEtag('hello')).toBe(a);
    expect(computeEtag('world')).not.toBe(a);
  });
});

// ---- handler integration with an injected fetch (no live Gitea) ----

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers) { this.statusCode = status; this.headers = headers ?? {}; },
    end(body) { this.body = body ?? ''; },
  };
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) };
}

function handlerWith(routes) {
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const page = Number(u.searchParams.get('page') ?? 1);
    const key = u.pathname;
    const responder = routes[key];
    if (!responder) return jsonResponse({ message: 'not found' }, 404);
    return responder(page, u);
  };
  return createGiteaHandler({
    resolveConfig: () => ({ giteaApi: 'http://gitea.test', token: 'tok' }),
    selfPort: 3456,
    fetchImpl,
  });
}

describe('createGiteaHandler (mocked upstream)', () => {
  it('normalises issues, sets X-Total-Count + ETag, and returns 304 on revalidation', async () => {
    const handle = handlerWith({
      '/api/v1/repos/o/r/issues': (page) =>
        page === 1
          ? jsonResponse([
              { number: 1, title: 'Plain issue', assignees: null, labels: null, pull_request: null },
              { number: 2, title: 'A PR', assignees: null, pull_request: { merged: false } },
            ])
          : jsonResponse([]),
    });

    const res1 = makeRes();
    const handled = await handle({ method: 'GET', url: '/repos/o/r/issues?state=all&per_page=100&page=1', headers: {} }, res1);
    expect(handled).toBe(true);
    expect(res1.statusCode).toBe(200);
    const body = JSON.parse(res1.body);
    expect(body).toHaveLength(2);
    expect(body[0].assignees).toEqual([]);
    expect(body[1].pull_request).toEqual({ merged: false });
    expect(res1.headers['X-Total-Count']).toBe('2');
    expect(res1.headers['X-RateLimit-Limit']).toBe('60');
    const etag = res1.headers.ETag;
    expect(etag).toMatch(/^"[0-9a-f]{40}"$/);

    const res2 = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/issues?state=all&per_page=100&page=1', headers: { 'if-none-match': etag } }, res2);
    expect(res2.statusCode).toBe(304);
  });

  it('aggregates Gitea pages (50-cap) into one GitHub-style response', async () => {
    const big = Array.from({ length: GITEA_PAGE_CAP }, (_, i) => ({ number: i + 1, assignees: [], pull_request: null }));
    const handle = handlerWith({
      '/api/v1/repos/o/r/issues': (page) =>
        page === 1 ? jsonResponse(big) : page === 2 ? jsonResponse([{ number: 51, assignees: [], pull_request: null }]) : jsonResponse([]),
    });
    const res = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/issues?state=all&per_page=100&page=1', headers: {} }, res);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(51);
    expect(res.headers['X-Total-Count']).toBe('51');
  });

  it('returns an empty array for a page past the end', async () => {
    const handle = handlerWith({
      '/api/v1/repos/o/r/issues': (page) => (page === 1 ? jsonResponse([{ number: 1, assignees: [], pull_request: null }]) : jsonResponse([])),
    });
    const res = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/issues?state=all&per_page=100&page=2', headers: {} }, res);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('returns trees with truncated:false', async () => {
    const handle = handlerWith({
      '/api/v1/repos/o/r/git/trees/main': () =>
        jsonResponse({ sha: 'abc', url: 'u', tree: [{ path: 'README.md', type: 'blob', sha: 'b1' }], total_count: 1, page: 1 }),
    });
    const res = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/git/trees/main?recursive=1', headers: {} }, res);
    const body = JSON.parse(res.body);
    expect(body.truncated).toBe(false);
    expect(body.tree).toHaveLength(1);
    expect(body.tree[0].path).toBe('README.md');
  });

  it('passes file contents through and 404s missing files', async () => {
    const handle = handlerWith({
      '/api/v1/repos/o/r/contents/a.yaml': () => jsonResponse({ name: 'a.yaml', encoding: 'base64', content: 'eA==', type: 'file' }),
    });
    const ok = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/contents/a.yaml?ref=main', headers: {} }, ok);
    expect(JSON.parse(ok.body).encoding).toBe('base64');

    const missing = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/contents/missing.yaml?ref=main', headers: {} }, missing);
    expect(missing.statusCode).toBe(404);
  });

  it('proxies releases: normalises to GitHub shape, filters drafts, sorts newest-first', async () => {
    const releases = [
      { id: 1, tag_name: 'v1.0', name: 'Release 1.0', body: 'notes', html_url: 'https://x/1', published_at: '2026-01-01T00:00:00Z', is_prerelease: false, is_draft: false },
      { id: 2, tag_name: 'v2.0', name: 'Release 2.0', body: '', html_url: 'https://x/2', published_at: '2026-02-01T00:00:00Z', is_prerelease: false, is_draft: false },
      { id: 3, tag_name: 'v3.0-draft', name: 'Draft', body: '', html_url: 'https://x/3', published_at: '2026-03-01T00:00:00Z', is_prerelease: false, is_draft: true },
    ];
    const handle = handlerWith({
      '/api/v1/repos/o/r/releases': (page) => page === 1 ? jsonResponse(releases) : jsonResponse([]),
    });
    const res = makeRes();
    await handle({ method: 'GET', url: '/repos/o/r/releases?per_page=30', headers: {} }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Draft filtered out.
    expect(body).toHaveLength(2);
    // Sorted newest-first.
    expect(body[0].tag_name).toBe('v2.0');
    expect(body[1].tag_name).toBe('v1.0');
    // GitHub-shaped fields.
    expect(typeof body[0].published_at).toBe('string');
    expect(typeof body[0].prerelease).toBe('boolean');
    // ETag present.
    expect(res.headers.ETag).toMatch(/^"[0-9a-f]{40}"$/);
    // X-Total-Count reflects non-draft count.
    expect(res.headers['X-Total-Count']).toBe('2');
  });

  it('ignores non-/repos paths so the host server can 404 them', async () => {
    const handle = handlerWith({});
    const res = makeRes();
    const handled = await handle({ method: 'GET', url: '/something-else', headers: {} }, res);
    expect(handled).toBe(false);
  });

  it('rejects non-GET methods with 405', async () => {
    const handle = handlerWith({});
    const res = makeRes();
    await handle({ method: 'POST', url: '/repos/o/r/issues', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
