#!/usr/bin/env node
/**
 * Mutable GitHub API twin for the full-loop e2e scenario.
 *
 * Extends the static fixture twin with:
 *   POST /actor/issues   — inject a new issue (actor mutation)
 *   POST /actor/releases — inject a new release (actor mutation)
 *   GET  /actor/state    — read injected items (for test verification)
 *   DELETE /actor/state  — reset injected items
 *
 * The injected items are held in memory and prepended to the fixture list on
 * every GET to /repos/…/issues or /repos/…/releases, so the CLI manifest
 * generator (KBEXPLORER_GH_API_BASE=<this server>) will see them in the same
 * request it sees the baseline fixture data.
 *
 * Port: FULL_LOOP_TWIN_PORT env (default 3558).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');
const PORT = Number(process.env.FULL_LOOP_TWIN_PORT ?? 3558);

// ── In-memory actor state ─────────────────────────────────────────────────────

/** Issues injected by actors at runtime. Prepended to fixture list. */
let injectedIssues = [];

/** Releases injected by actors at runtime. Prepended to fixture list. */
let injectedReleases = [];

let nextIssueNumber = 90000; // high enough not to collide with real fixture numbers

// ── Fixture helpers ───────────────────────────────────────────────────────────

function loadFixture(name) {
  const fp = resolve(FIXTURES, name);
  if (!existsSync(fp)) return null;
  return JSON.parse(readFileSync(fp, 'utf8'));
}

function respond(res, statusCode, body, options = {}) {
  const json = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-RateLimit-Limit': '5000',
    'X-RateLimit-Remaining': '4999',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    'ETag': options.etag ?? `"full-loop-${Date.now()}"`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'ETag, X-RateLimit-Remaining, X-RateLimit-Reset, Link, X-Total-Count',
  };
  if (options.link) headers['Link'] = options.link;
  res.writeHead(statusCode, headers);
  res.end(json);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ── GitHub REST routes ────────────────────────────────────────────────────────

const routes = [
  { pattern: /^\/repos\/[^/]+\/[^/]+\/git\/trees\//, fixture: 'tree.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/issues(?:\?|$)/, key: 'issues' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/pulls(?:\?|$)/, fixture: 'pulls.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/commits(?:\?|$)/, fixture: 'commits.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/releases(?:\?|$)/, key: 'releases' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)/, fixtureFromPath: true },
];

const server = createServer(async (req, res) => {
  const [pathname, search] = (req.url ?? '/').split('?');
  const params = new URLSearchParams(search ?? '');
  const method = req.method ?? 'GET';

  // ── Health check ────────────────────────────────────────────────────────────
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match, Content-Type',
    });
    return res.end();
  }

  console.log(`[full-loop-twin] ${method} ${req.url}`);

  // ── Actor API ────────────────────────────────────────────────────────────────

  if (pathname === '/actor/issues' && method === 'POST') {
    const body = await readBody(req);
    const issue = {
      url: `http://localhost:${PORT}/repos/anokye-labs/kbexplorer-template/issues/${nextIssueNumber}`,
      html_url: `http://localhost:${PORT}/anokye-labs/kbexplorer-template/issues/${nextIssueNumber}`,
      id: nextIssueNumber,
      node_id: `fullloop-${nextIssueNumber}`,
      number: nextIssueNumber++,
      title: body.title ?? `Full-loop actor issue ${Date.now()}`,
      body: body.body ?? 'Opened by the full-loop actor.',
      state: 'open',
      labels: (body.labels ?? []).map(name =>
        typeof name === 'string' ? { id: 1, name, color: '0075ca', default: false } : name,
      ),
      assignees: [],
      user: { login: 'full-loop-actor', id: 0, avatar_url: '' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    injectedIssues = [issue, ...injectedIssues];
    console.log(`[full-loop-twin] Actor opened issue #${issue.number}: "${issue.title}"`);
    return respond(res, 201, issue);
  }

  if (pathname === '/actor/releases' && method === 'POST') {
    const body = await readBody(req);
    const release = {
      tag_name: body.tag_name ?? `v0.0.${Date.now()}`,
      name: body.name ?? body.tag_name ?? `Full-loop release ${Date.now()}`,
      body: body.body ?? 'Released by the full-loop actor.',
      html_url: `http://localhost:${PORT}/anokye-labs/kbexplorer-template/releases/tag/${body.tag_name ?? 'vX'}`,
      published_at: new Date().toISOString(),
      prerelease: body.prerelease ?? false,
      draft: false,
      id: Date.now(),
    };
    injectedReleases = [release, ...injectedReleases];
    console.log(`[full-loop-twin] Actor cut release ${release.tag_name}: "${release.name}"`);
    return respond(res, 201, release);
  }

  if (pathname === '/actor/state' && method === 'GET') {
    return respond(res, 200, { issues: injectedIssues, releases: injectedReleases });
  }

  if (pathname === '/actor/state' && method === 'DELETE') {
    injectedIssues = [];
    injectedReleases = [];
    return respond(res, 204, {});
  }

  // ── GitHub REST ──────────────────────────────────────────────────────────────

  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (!match) continue;

    // File-content routes
    if (route.fixtureFromPath) {
      const contentPath = match[1];
      const encoded = contentPath.replace(/\//g, '%2F');
      const data = loadFixture(`files/${encoded}.json`);
      if (!data) {
        return respond(res, 404, { message: 'Not Found' });
      }
      return respond(res, 200, data, { etag: `"${encoded}-single"` });
    }

    // Mutable list: issues or releases
    if (route.key === 'issues') {
      const fixture = loadFixture('issues.json') ?? [];
      const data = [...injectedIssues, ...fixture];
      const perPage = Math.min(Number(params.get('per_page') ?? 30), 200);
      const page = Number(params.get('page') ?? 1);
      const start = (page - 1) * perPage;
      const end = page * perPage;
      const sliced = data.slice(start, end);
      const hasNext = end < data.length;
      const etag = `"issues-${data.length}-${injectedIssues.length}"`;
      const opts = { etag };
      if (hasNext) {
        opts.link = `<http://localhost:${PORT}${pathname}?per_page=${perPage}&page=${page + 1}>; rel="next"`;
      }
      return respond(res, 200, sliced, opts);
    }

    if (route.key === 'releases') {
      const fixture = loadFixture('releases.json') ?? [];
      const data = [...injectedReleases, ...fixture];
      const perPage = Math.min(Number(params.get('per_page') ?? 30), 100);
      const page = Number(params.get('page') ?? 1);
      const sliced = data.slice((page - 1) * perPage, page * perPage);
      return respond(res, 200, sliced, {
        etag: `"releases-${data.length}-${injectedReleases.length}"`,
      });
    }

    // Static fixtures
    const data = loadFixture(route.fixture);
    if (!data) return respond(res, 404, { message: 'Not Found' });

    if (Array.isArray(data)) {
      const perPage = Math.min(Number(params.get('per_page') ?? 30), 100);
      const page = Number(params.get('page') ?? 1);
      const start = (page - 1) * perPage;
      const end = page * perPage;
      const sliced = data.slice(start, end);
      const hasNext = end < data.length;
      const opts = { etag: `"${route.fixture}-${data.length}"` };
      if (hasNext) {
        const nextUrl = `http://localhost:${PORT}${pathname}?per_page=${perPage}&page=${page + 1}`;
        opts.link = `<${nextUrl}>; rel="next"`;
      }
      return respond(res, 200, sliced, opts);
    }

    return respond(res, 200, data, { etag: `"${route.fixture}-single"` });
  }

  respond(res, 404, { message: `No twin route for ${pathname}` });
});

server.listen(PORT, () => {
  console.log(`[full-loop-twin] Serving on http://localhost:${PORT}`);
});
