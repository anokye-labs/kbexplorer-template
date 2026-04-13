#!/usr/bin/env node
/**
 * GitHub API twin — a zero-dependency local HTTP server that replays
 * canned fixture responses, mimicking api.github.com.
 *
 * Start:  node twins/github/server.js
 * Port:   TWIN_PORT env var (default 3456)
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');
const PORT = Number(process.env.TWIN_PORT ?? 3456);

// Optional scenario override via TWIN_SCENARIO env var
let scenario = null;
if (process.env.TWIN_SCENARIO) {
  const scenarioPath = resolve(__dirname, 'scenarios', process.env.TWIN_SCENARIO + '.js');
  if (existsSync(scenarioPath)) {
    scenario = await import(pathToFileURL(scenarioPath).href);
    console.log(`[twin] Loaded scenario: ${process.env.TWIN_SCENARIO}`);
  } else {
    console.error(`[twin] Scenario not found: ${scenarioPath}`);
    process.exit(1);
  }
}

const routes = [
  { pattern: /^\/repos\/[^/]+\/[^/]+\/git\/trees\//, fixture: 'tree.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/issues(?:\?|$)/, fixture: 'issues.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/pulls(?:\?|$)/, fixture: 'pulls.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/commits(?:\?|$)/, fixture: 'commits.json' },
  { pattern: /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)/, fixtureFromPath: true },
];

function respond(res, statusCode, body, options = {}) {
  const json = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-RateLimit-Remaining': '59',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    'ETag': options.etag ?? '"fixture-etag"',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag, X-RateLimit-Remaining, X-RateLimit-Reset, Link',
  };
  if (options.link) headers['Link'] = options.link;
  res.writeHead(statusCode, headers);
  res.end(json);
}

function loadFixture(name) {
  const fp = resolve(FIXTURES, name);
  if (!existsSync(fp)) return null;
  return JSON.parse(readFileSync(fp, 'utf8'));
}

const server = createServer(async (req, res) => {
  const [pathname, search] = (req.url ?? '/').split('?');
  const params = new URLSearchParams(search ?? '');
  const method = req.method ?? 'GET';

  // Health check for Playwright webServer readiness probe
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match',
    });
    return res.end();
  }

  console.log(`[twin] ${method} ${req.url}`);

  // Scenario intercept — if the scenario handles the request, stop here
  if (scenario?.intercept) {
    const handled = await scenario.intercept(req, res);
    if (handled) return;
  }

  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (!match) continue;

    // File-content routes: resolve fixture from captured path
    if (route.fixtureFromPath) {
      const contentPath = match[1];
      const encoded = contentPath.replace(/\//g, '%2F');
      const fixtureName = `files/${encoded}.json`;
      const data = loadFixture(fixtureName);
      if (!data) {
        return respond(res, 404, { message: 'Not Found', documentation_url: 'https://docs.github.com/rest' });
      }
      return respond(res, 200, data, { etag: `"${fixtureName}-single"` });
    }

    // Array fixtures with pagination support
    const data = loadFixture(route.fixture);
    if (!data) {
      return respond(res, 404, { message: 'Not Found', documentation_url: 'https://docs.github.com/rest' });
    }

    if (Array.isArray(data)) {
      const perPage = Math.min(Number(params.get('per_page') ?? 30), 100);
      const page = Number(params.get('page') ?? 1);
      const start = (page - 1) * perPage;
      const end = page * perPage;
      const sliced = data.slice(start, end);
      const hasNext = end < data.length;

      const options = { etag: `"${route.fixture}-${data.length}"` };
      if (hasNext) {
        const nextUrl = `http://localhost:${PORT}${pathname}?per_page=${perPage}&page=${page + 1}`;
        options.link = `<${nextUrl}>; rel="next"`;
      }
      return respond(res, 200, sliced, options);
    }

    return respond(res, 200, data, { etag: `"${route.fixture}-single"` });
  }

  respond(res, 404, { message: `No twin route for ${pathname}`, documentation_url: 'https://docs.github.com/rest' });
});

server.listen(PORT, () => {
  console.log(`[twin] Serving on http://localhost:${PORT}`);
});
