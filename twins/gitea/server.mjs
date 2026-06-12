#!/usr/bin/env node
/**
 * Gitea twin HTTP server — the stateful counterpart to twins/github/server.js.
 *
 * Serves the GitHub-REST → Gitea-API translation adapter on the SAME port the
 * static twin uses (TWIN_PORT, default 3456), so the app talks to it via the
 * unchanged `VITE_GH_API_BASE=http://localhost:3456` seam. The static twin is
 * left entirely untouched; this is an additive, opt-in second entry point.
 *
 * Start:  node twins/gitea/server.mjs
 * Needs:  a running, seeded Gitea (see twins/gitea/bootstrap.mjs + seed.mjs).
 *
 * Connection info + admin token are read lazily from `.dtu/state.json` (or env),
 * so this server can be started before or after Gitea bootstrap completes.
 */
import { createServer } from 'node:http';
import { createGiteaHandler } from './adapter.mjs';
import { HARNESS, resolveGiteaConfig } from './state.mjs';

const PORT = HARNESS.twinPort;

const handle = createGiteaHandler({
  selfPort: PORT,
  resolveConfig: resolveGiteaConfig,
});

const server = createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const [pathname] = (req.url ?? '/').split('?');

  // Readiness probe for Playwright webServer.
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    return res.end('OK');
  }

  // CORS preflight — the app sends If-None-Match which forces a preflight.
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match',
    });
    return res.end();
  }

  console.log(`[gitea-twin] ${method} ${req.url}`);

  const handled = await handle(req, res);
  if (!handled) {
    res.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ message: `No twin route for ${pathname}`, documentation_url: 'https://docs.github.com/rest' }));
  }
});

server.listen(PORT, () => {
  const { giteaApi, token } = resolveGiteaConfig();
  console.log(`[gitea-twin] Serving on http://localhost:${PORT} → ${giteaApi} (token ${token ? 'present' : 'MISSING'})`);
});
