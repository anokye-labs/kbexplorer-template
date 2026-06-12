/**
 * GitHub-REST → Gitea-API translation adapter.
 *
 * The kbexplorer app speaks GitHub REST v3 (paths under `/repos/...`, params like
 * `per_page` / `recursive=1`, GitHub-shaped JSON, ETag/304 refresh). Gitea exposes
 * a structurally similar but not identical API under `/api/v1/...` (param `limit`,
 * `recursive=true`, no ETag headers, `assignees: null` instead of `[]`, a 50-item
 * page cap). This adapter sits on the same `VITE_GH_API_BASE` seam the static twin
 * uses (port 3456) and translates **reads** so the app talks to a live, stateful
 * Gitea instance without any app-code change.
 *
 * The translation rules below are grounded in real Gitea 1.24 responses captured
 * during harness bring-up (see twins/gitea/README.md), not assumptions.
 *
 * Pure helpers (translatePath, translateQuery, normalizeIssue, paginate, computeEtag,
 * buildLinkHeader) are exported for fast unit testing without a running Gitea.
 * `createGiteaHandler` wires them to live `fetch` for e2e use.
 */
import { createHash } from 'node:crypto';

/** Default Gitea base (no trailing slash). */
export const DEFAULT_GITEA_API = 'http://localhost:3000';

/** Gitea caps a single API page at 50 items regardless of the requested limit. */
export const GITEA_PAGE_CAP = 50;

/**
 * Translate a GitHub REST query string into Gitea's equivalent.
 * - `per_page=N` → `limit=N`
 * - `recursive=1` → `recursive=true`
 * Other params (`state`, `sha`, `ref`, `page`, `type`) pass through unchanged.
 */
export function translateQuery(search, { dropPagination = false } = {}) {
  const inParams = new URLSearchParams(search ?? '');
  const out = new URLSearchParams();
  for (const [key, value] of inParams) {
    if (key === 'per_page') {
      if (!dropPagination) out.set('limit', value);
      continue;
    }
    if (key === 'page') {
      if (!dropPagination) out.set('page', value);
      continue;
    }
    if (key === 'recursive') {
      out.set('recursive', value === '1' || value === 'true' ? 'true' : 'false');
      continue;
    }
    out.set(key, value);
  }
  return out;
}

/**
 * Parse a GitHub-style request path into a recognised resource.
 * Returns `null` for anything outside the supported `/repos/...` surface.
 */
export function parseRoute(pathname) {
  let m;
  if ((m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/(.+)$/))) {
    return { kind: 'trees', owner: m[1], repo: m[2], ref: decodeURIComponent(m[3]) };
  }
  if ((m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/))) {
    return { kind: 'contents', owner: m[1], repo: m[2], path: m[3] };
  }
  if ((m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/issues\/?$/))) {
    return { kind: 'issues', owner: m[1], repo: m[2] };
  }
  if ((m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/pulls\/?$/))) {
    return { kind: 'pulls', owner: m[1], repo: m[2] };
  }
  if ((m = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/commits\/?$/))) {
    return { kind: 'commits', owner: m[1], repo: m[2] };
  }
  return null;
}

/** Build the upstream Gitea `/api/v1` URL for a parsed route. */
export function translatePath(route) {
  const base = `/api/v1/repos/${route.owner}/${route.repo}`;
  switch (route.kind) {
    case 'trees':
      return `${base}/git/trees/${encodeURIComponent(route.ref)}`;
    case 'contents':
      return `${base}/contents/${route.path}`;
    case 'issues':
      return `${base}/issues`;
    case 'pulls':
      return `${base}/pulls`;
    case 'commits':
      return `${base}/commits`;
    default:
      return base;
  }
}

/**
 * Normalise a Gitea issue/PR object to the GitHub shape the app expects.
 * The only material divergence is `assignees: null` (GitHub uses `[]`) and
 * labels carrying extra fields (a harmless superset). `pull_request` is left
 * as-is (object for PRs in the issues feed, null for plain issues) so the app's
 * `!i.pull_request` filter keeps working.
 */
export function normalizeIssue(issue) {
  return {
    ...issue,
    assignees: Array.isArray(issue.assignees) ? issue.assignees : [],
    labels: Array.isArray(issue.labels) ? issue.labels : [],
  };
}

/** GitHub-style page slicing over a fully-aggregated array. */
export function paginate(items, page, perPage) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(perPage) || 30);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  const hasNext = start + size < items.length;
  return { slice, hasNext, page: p, perPage: size };
}

/** Build a GitHub-style `Link` header advertising the next page, if any. */
export function buildLinkHeader(selfBase, pathname, page, perPage, hasNext) {
  if (!hasNext) return undefined;
  const next = `${selfBase}${pathname}?per_page=${perPage}&page=${page + 1}`;
  return `<${next}>; rel="next"`;
}

/** Strong ETag derived from the response body (Gitea sends none of its own). */
export function computeEtag(bodyString) {
  return `"${createHash('sha1').update(bodyString).digest('hex')}"`;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Link, X-Total-Count',
};

function ghHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-RateLimit-Limit': '60',
    'X-RateLimit-Remaining': '59',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    ...CORS_HEADERS,
    ...extra,
  };
}

/**
 * Create the live request handler. Returns an async `(req, res) => boolean`
 * that resolves true when it handled the request (so the host server can 404
 * anything it returns false for).
 *
 * @param {object} opts
 * @param {string} [opts.giteaApi] Gitea base URL (default http://localhost:3000)
 * @param {string} [opts.token]    Gitea API token (kept server-side; never sent to the browser)
 * @param {() => {giteaApi?: string, token?: string}} [opts.resolveConfig]
 *        Lazy resolver for Gitea coords/token, re-read per request. Lets the
 *        host server pick up connection info written to disk after startup,
 *        removing any process-start ordering dependency.
 * @param {number} [opts.selfPort] Port this adapter is served on (for Link headers)
 * @param {typeof fetch} [opts.fetchImpl] Injectable fetch (tests)
 */
export function createGiteaHandler(opts = {}) {
  const staticApi = (opts.giteaApi ?? process.env.GITEA_API ?? DEFAULT_GITEA_API).replace(/\/$/, '');
  const staticToken = opts.token ?? process.env.GITEA_TOKEN ?? '';
  const resolveConfig = opts.resolveConfig ?? (() => ({ giteaApi: staticApi, token: staticToken }));
  const selfPort = opts.selfPort ?? Number(process.env.TWIN_PORT ?? 3456);
  const selfBase = `http://localhost:${selfPort}`;
  const doFetch = opts.fetchImpl ?? fetch;

  async function giteaGet(path, search) {
    const cfg = resolveConfig() ?? {};
    const giteaApi = (cfg.giteaApi ?? staticApi).replace(/\/$/, '');
    const token = cfg.token ?? staticToken;
    const qs = search && [...search].length ? `?${search}` : '';
    const url = `${giteaApi}${path}${qs}`;
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `token ${token}`;
    return doFetch(url, { headers });
  }

  /** Fetch every Gitea page for a list resource and concatenate. */
  async function giteaGetAll(path, baseSearch) {
    const all = [];
    let page = 1;
    while (true) {
      const search = new URLSearchParams(baseSearch);
      search.set('limit', String(GITEA_PAGE_CAP));
      search.set('page', String(page));
      const res = await giteaGet(path, search);
      if (!res.ok) return { ok: false, status: res.status };
      const chunk = await res.json();
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      all.push(...chunk);
      if (chunk.length < GITEA_PAGE_CAP) break;
      page += 1;
      if (page > 100) break; // hard safety stop
    }
    return { ok: true, items: all };
  }

  function send(res, status, headers, bodyString) {
    res.writeHead(status, headers);
    res.end(bodyString ?? '');
  }

  function notModifiedOr(res, req, bodyString, extraHeaders = {}) {
    const etag = computeEtag(bodyString);
    const inm = req.headers['if-none-match'];
    if (inm && inm === etag) {
      send(res, 304, ghHeaders({ ETag: etag, ...extraHeaders }));
      return;
    }
    send(res, 200, ghHeaders({ ETag: etag, ...extraHeaders }), bodyString);
  }

  function ghError(res, status, message) {
    send(res, status, ghHeaders(), JSON.stringify({ message, documentation_url: 'https://docs.github.com/rest' }));
  }

  return async function handle(req, res) {
    const method = req.method ?? 'GET';
    const [pathname, search] = (req.url ?? '/').split('?');
    const route = parseRoute(pathname);
    if (!route) return false;
    if (method !== 'GET') {
      ghError(res, 405, `Method ${method} not supported by Gitea adapter`);
      return true;
    }

    try {
      if (route.kind === 'trees') {
        const upstream = translatePath(route);
        const first = await giteaGet(upstream, translateQuery(search));
        if (!first.ok) { ghError(res, first.status, 'Gitea trees error'); return true; }
        const data = await first.json();
        let tree = Array.isArray(data.tree) ? data.tree : [];
        let page = Number(data.page ?? 1);
        while (data.total_count && tree.length < data.total_count) {
          page += 1;
          const more = await giteaGet(upstream, translateQuery(`${search ?? ''}&page=${page}`));
          if (!more.ok) break;
          const moreData = await more.json();
          if (!Array.isArray(moreData.tree) || moreData.tree.length === 0) break;
          tree = tree.concat(moreData.tree);
          if (moreData.tree.length < GITEA_PAGE_CAP) break;
        }
        const body = JSON.stringify({ sha: data.sha, url: data.url, tree, truncated: false });
        notModifiedOr(res, req, body);
        return true;
      }

      if (route.kind === 'contents') {
        const upstream = translatePath(route);
        const r = await giteaGet(upstream, translateQuery(search));
        if (r.status === 404) { ghError(res, 404, 'Not Found'); return true; }
        if (!r.ok) { ghError(res, r.status, 'Gitea contents error'); return true; }
        const data = await r.json();
        notModifiedOr(res, req, JSON.stringify(data));
        return true;
      }

      // List resources: issues, pulls, commits — aggregate then GitHub-slice.
      const inParams = new URLSearchParams(search ?? '');
      const page = Number(inParams.get('page') ?? 1);
      const perPage = Number(inParams.get('per_page') ?? 30);

      // Pass through non-pagination filters to Gitea (state, sha, type…).
      const filter = new URLSearchParams();
      for (const [k, v] of inParams) {
        if (k === 'per_page' || k === 'page' || k === 'recursive') continue;
        filter.set(k, v);
      }

      const upstream = translatePath(route);
      const agg = await giteaGetAll(upstream, filter);
      if (!agg.ok) { ghError(res, agg.status, `Gitea ${route.kind} error`); return true; }

      let items = agg.items;
      if (route.kind === 'issues' || route.kind === 'pulls') {
        items = items.map(normalizeIssue);
      }

      const { slice, hasNext } = paginate(items, page, perPage);
      const link = buildLinkHeader(selfBase, pathname, page, perPage, hasNext);
      const extra = { 'X-Total-Count': String(items.length) };
      if (link) extra.Link = link;
      notModifiedOr(res, req, JSON.stringify(slice), extra);
      return true;
    } catch (err) {
      ghError(res, 502, `Gitea adapter upstream failure: ${err?.message ?? err}`);
      return true;
    }
  };
}
