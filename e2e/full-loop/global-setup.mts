/**
 * Full-loop global setup.
 *
 * Exercises the real deployment shape end-to-end — without requiring Podman or
 * a live Gitea — using the **static GitHub twin** as the backing store:
 *
 *   1. Spawn a temporary mutable twin server (the static twin + actor REST API)
 *      that lives only for the duration of this setup routine.
 *   2. An actor POSTs a sentinel issue to the twin's /actor/issues endpoint
 *      (the same surface the full Gitea harness uses, just backed by fixtures).
 *   3. The CLI's DTU-aware generateManifest() fetches live data from the twin
 *      (KBEXPLORER_GH_API_BASE=<twin>), writing src/generated/repo-manifest.json.
 *      This is the *exact* path the CLI↔DTU seam uses in production.
 *   4. The sentinel title is written to .dtu/full-loop-state.json so the spec
 *      can read it without coupling the assertion to this file.
 *   5. The temporary twin server is torn down; Playwright's webServer then brings
 *      up Vite in local mode (VITE_KB_LOCAL=true, VITE_KB_SKIP_REGEN=1) to serve
 *      the freshly generated manifest.
 *
 * ## Substrate
 * A minimal in-process mutable GitHub twin defined in this file
 * (startMutableTwin) — deterministic, no Podman. It serves the
 * twins/github/fixtures with actor-injected items prepended on every read.
 *
 * ## Deferred gap — live Gitea half
 * The mutation here is synthetic (fixture injection) rather than a real Gitea
 * mutation. To close the gap, replace step 1-2 with:
 *   - npm run dtu:up && npm run dtu:seed  (Podman Gitea bootstrap)
 *   - import { openIssue } from '../../twins/gitea/actors/open-issue.mjs'
 *   - set KBEXPLORER_GH_API_BASE to the Gitea adapter (twins/gitea/server.mjs)
 * The rest of the scenario (step 3 onwards) is unchanged. See playwright.full-loop.config.ts
 * for the FULL_LOOP_SUBSTRATE env-var switch that toggles between the two halves.
 */

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Path to the kbexplorer-cli repository.
 *
 * Resolution order:
 *   1. KBEXPLORER_CLI_PATH env var (useful in CI or non-standard layouts)
 *   2. Sibling directory ../kbexplorer-cli relative to the repo root (workspace convention)
 *
 * The CLI is not installed as an npm dependency; it lives in a separate repo
 * that must be present locally for the full-loop to run.
 */
const CLI_REPO = process.env.KBEXPLORER_CLI_PATH ?? resolve(REPO_ROOT, '..', 'kbexplorer-cli');
const FIXTURES_DIR = resolve(REPO_ROOT, 'twins', 'github', 'fixtures');
const MANIFEST_OUT = resolve(REPO_ROOT, 'src', 'generated', 'repo-manifest.json');
const DTU_DIR = resolve(REPO_ROOT, '.dtu');
const STATE_FILE = resolve(DTU_DIR, 'full-loop-state.json');

const SETUP_PORT = Number(process.env.FULL_LOOP_SETUP_PORT ?? 3559);

// ── Minimal in-process mutable twin ──────────────────────────────────────────

/**
 * Build and start an in-process mutable fixture server.
 * Returns { injectIssue, stop }: injectIssue prepends an item the subsequent
 * fixture reads will include; stop closes the server.
 */
function startMutableTwin(port: number): Promise<{
  injectIssue: (issue: Record<string, unknown>) => void;
  stop: () => Promise<void>;
}> {
  let injectedIssues: Record<string, unknown>[] = [];

  function loadFixture(name: string): unknown {
    const fp = resolve(FIXTURES_DIR, name);
    if (!existsSync(fp)) return null;
    return JSON.parse(readFileSync(fp, 'utf-8'));
  }

  function sendJSON(res: import('node:http').ServerResponse, status: number, body: unknown) {
    const json = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-RateLimit-Limit': '5000',
      'X-RateLimit-Remaining': '4999',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
      'ETag': `"setup-${Date.now()}"`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match, Content-Type',
      'Access-Control-Expose-Headers': 'ETag, X-RateLimit-Remaining, X-RateLimit-Reset',
    });
    res.end(json);
  }

  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    const [pathname, search] = url.split('?');
    const params = new URLSearchParams(search ?? '');

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('OK');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Accept, If-None-Match, Content-Type',
      });
      return res.end();
    }

    console.log(`[setup-twin] ${req.method} ${url}`);

    // Issues — prepend injected items
    if (/^\/repos\/[^/]+\/[^/]+\/issues(\?|$)/.test(pathname)) {
      const fixture = (loadFixture('issues.json') as unknown[]) ?? [];
      const all = [...injectedIssues, ...fixture];
      const perPage = Math.min(Number(params.get('per_page') ?? 200), 200);
      const page = Number(params.get('page') ?? 1);
      const sliced = all.slice((page - 1) * perPage, page * perPage);
      return sendJSON(res, 200, sliced);
    }

    // Pulls — serve fixture as-is
    if (/^\/repos\/[^/]+\/[^/]+\/pulls(\?|$)/.test(pathname)) {
      const fixture = (loadFixture('pulls.json') as unknown[]) ?? [];
      const perPage = Math.min(Number(params.get('per_page') ?? 200), 200);
      const page = Number(params.get('page') ?? 1);
      return sendJSON(res, 200, fixture.slice((page - 1) * perPage, page * perPage));
    }

    // Releases — serve fixture as-is
    if (/^\/repos\/[^/]+\/[^/]+\/releases(\?|$)/.test(pathname)) {
      const fixture = (loadFixture('releases.json') as unknown[]) ?? [];
      const perPage = Math.min(Number(params.get('per_page') ?? 30), 100);
      const page = Number(params.get('page') ?? 1);
      return sendJSON(res, 200, fixture.slice((page - 1) * perPage, page * perPage));
    }

    // Commits — serve fixture as-is
    if (/^\/repos\/[^/]+\/[^/]+\/commits(\?|$)/.test(pathname)) {
      return sendJSON(res, 200, (loadFixture('commits.json') as unknown[]) ?? []);
    }

    // Tree
    if (/^\/repos\/[^/]+\/[^/]+\/git\/trees\//.test(pathname)) {
      return sendJSON(res, 200, loadFixture('tree.json') ?? { tree: [] });
    }

    // File contents
    const contentsMatch = pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)/);
    if (contentsMatch) {
      const encoded = contentsMatch[1].replace(/\//g, '%2F');
      const data = loadFixture(`files/${encoded}.json`);
      if (data) return sendJSON(res, 200, data);
      return sendJSON(res, 404, { message: 'Not Found' });
    }

    sendJSON(res, 404, { message: `No twin route for ${pathname}` });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`[setup-twin] Listening on http://localhost:${port}`);
      resolve({
        injectIssue(issue: Record<string, unknown>) {
          injectedIssues = [issue, ...injectedIssues];
        },
        stop: () => new Promise<void>((res, rej) => server.close(err => err ? rej(err) : res())),
      });
    });
    server.on('error', reject);
  });
}

// ── Global setup entry point ──────────────────────────────────────────────────

export default async function globalSetup() {
  console.log('\n[full-loop:setup] Starting mutable static twin…');

  // 1. Bring up the in-process mutable twin
  const twin = await startMutableTwin(SETUP_PORT);

  try {
    // 2. Actor: inject a uniquely-titled sentinel issue
    const nonce = Date.now();
    const sentinelTitle = `Full-loop actor issue ${nonce}`;
    const sentinelIssue = {
      url: `http://localhost:${SETUP_PORT}/repos/anokye-labs/kbexplorer-template/issues/90001`,
      html_url: `http://localhost:${SETUP_PORT}/anokye-labs/kbexplorer-template/issues/90001`,
      id: 90001,
      node_id: `fullloop-90001`,
      number: 90001,
      title: sentinelTitle,
      body: 'Opened by the full-loop actor. Validates the actor→twin→CLI→app path.',
      state: 'open',
      labels: [{ id: 1, name: 'full-loop', color: '0075ca', default: false }],
      assignees: [],
      user: { login: 'full-loop-actor', id: 0, avatar_url: '' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    twin.injectIssue(sentinelIssue);
    console.log(`[full-loop:setup] Actor injected sentinel issue: "${sentinelTitle}"`);

    // 3. CLI manifest regen from the twin via the DTU-aware path
    //    We call the CLI library's generateManifest() directly so KBEXPLORER_GH_API_BASE
    //    is respected. (This predates `kbx manifest`'s current thin-over-engine
    //    design — anokye-labs/kbexplorer-template#511 — which no longer delegates to
    //    an app-local generator script at all. Calling the library directly here
    //    exercises the keystone DTU-aware path explicitly.)
    console.log(`[full-loop:setup] CLI regen: KBEXPLORER_GH_API_BASE=http://localhost:${SETUP_PORT}`);
    process.env.KBEXPLORER_GH_API_BASE = `http://localhost:${SETUP_PORT}`;
    process.env.KBEXPLORER_GH_TOKEN = 'full-loop-test-token';

    const cliManifestPath = resolve(CLI_REPO, 'src', 'lib', 'manifest.js');
    if (!existsSync(cliManifestPath)) {
      throw new Error(
        `[full-loop:setup] kbexplorer-cli not found at ${CLI_REPO}. ` +
        `Set KBEXPLORER_CLI_PATH to the CLI repo root or clone it alongside this repo.`,
      );
    }
    const { generateManifest } = await import(
      /* @vite-ignore */
      pathToFileURL(cliManifestPath).href
    ) as { generateManifest: (root: string) => Promise<Record<string, unknown>> };

    const manifest = await generateManifest(REPO_ROOT);

    // 4. Write the manifest to the app's generated path
    mkdirSync(resolve(REPO_ROOT, 'src', 'generated'), { recursive: true });
    writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[full-loop:setup] Manifest written → ${MANIFEST_OUT}`);

    // Verify sentinel is in the manifest
    const issues = manifest.issues as Array<{ title: string }>;
    const found = issues.some(i => i.title === sentinelTitle);
    if (!found) {
      throw new Error(
        `[full-loop:setup] Sentinel issue "${sentinelTitle}" not found in generated manifest! ` +
        `Got ${issues.length} issues: ${issues.slice(0, 3).map(i => i.title).join(', ')} …`,
      );
    }
    console.log(`[full-loop:setup] Sentinel confirmed in manifest (${issues.length} issues total)`);

    // 5. Persist state for the spec (holdout rule: assertions live in the spec, not here)
    mkdirSync(DTU_DIR, { recursive: true });
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ sentinelTitle, nonce, substrate: 'static-twin', generatedAt: new Date().toISOString() }, null, 2),
    );
    console.log(`[full-loop:setup] State written → ${STATE_FILE}`);

  } finally {
    await twin.stop();
    console.log('[full-loop:setup] Mutable twin stopped');
  }
}
