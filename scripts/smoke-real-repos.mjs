/**
 * Cross-real-repository smoke for the remote GitHubApiSource path.
 * ===============================================================
 *
 * WHY THIS EXISTS (DTU bit-rot audit #394, P2 follow-up)
 * ------------------------------------------------------
 * kbexplorer's remote path (`src/api/github.ts` → `GitHubApiSource` →
 * `loadKnowledgeBase`) is exercised in CI ONLY against twins: the static
 * golden fixture and the Gitea harness (both behind the `VITE_GH_API_BASE`
 * seam). Those twins cover RESPONSE SHAPES (empty / 404 / 304 / rate-limit /
 * slow) but NOT the diverse shapes of *real* GitHub repositories. The repo that
 * used to provide the "does the app actually work against a real GitHub repo"
 * leg — `kbexplorer-pilot-fixture` — has been ARCHIVED/obsoleted, leaving that
 * leg with NO replacement.
 *
 * This script restores that coverage: it drives the REAL code path
 * (`loadRemoteKnowledgeBase`, loaded verbatim from `src/` via Vite SSR so we
 * test the shipping modules, not a re-implementation) against the LIVE
 * `https://api.github.com` for a few small, varied, stable PUBLIC repos and
 * asserts KBGraph INVARIANTS — never exact counts (real repos drift over time;
 * exact counts would be flaky).
 *
 * It is SCHEDULED + workflow_dispatch ONLY (see
 * `.github/workflows/cross-real-repo.yml`) and is NEVER a required PR check.
 *
 * REPO SELECTION (axes of variation, measured 2026-06 via `gh api`)
 * ----------------------------------------------------------------
 * The TARGET_REPOS list below is the single editable knob. Each entry is a
 * deliberate, documented shape. Chosen for BOUNDED issue/PR history (so the
 * paginated `state=all` fetches stay fast and the run can't rate-limit), while
 * spanning: tiny↔rich, releases↔none, main↔master default branch, our-org↔
 * external-org, active↔archived, uppercase-README↔none.
 *
 *   • anokye-labs/kbexplorer            — the canonical DEFAULT target; tiny &
 *       stable; has a `content/` dir so we drive the authored-content + config
 *       path too. Minimal real shape.
 *   • anokye-labs/kbexplorer-template   — our OWN repo (the realest self-host
 *       target): full shape — large file tree, hundreds of issues/PRs, a
 *       release, and a big `.github/` structural fan-out. The default workflow
 *       token always reads it regardless of visibility.
 *   • sindresorhus/slugify             — EXTERNAL org; small but with STABLE
 *       releases (~17). NOTE: it ships a lowercase `readme.md`, and the loader
 *       only recognises an uppercase `README.md`, so NO `readme` node is
 *       produced and the hub legitimately falls back to `repo-root`. That is a
 *       real shape, not a failure — hence `readme` is a per-repo expectation.
 *   • github/scripts-to-rule-them-all  — EXTERNAL org, ARCHIVED, default branch
 *       `master` (catches any `main`-only assumption), and ZERO issues (empty
 *       work-family tolerance). Proves an archived real repo still loads —
 *       fitting, given the audit was about an archived fixture.
 *
 * DELIBERATELY OMITTED: octocat/Hello-World. Despite being the textbook "tiny"
 * repo, it has accumulated ~7,700 issues + ~1,650 PRs from tutorials, so its
 * `state=all` pagination is ~90 requests — slow and wasteful while adding no
 * invariant coverage the tiny repos above don't already give.
 *
 * AUTH / RATE-LIMIT NOTE
 * ----------------------
 * The shipping runtime client (`ghFetch`) is browser code and sends NO token.
 * Unauthenticated `api.github.com` allows only 60 req/hr — which the combined
 * pagination + `.github/*` structural fan-out blows through immediately, making
 * a real-API smoke flaky for the wrong reason. We therefore patch the GLOBAL
 * `fetch` at the transport layer ONLY to (a) attach `Authorization: Bearer
 * $GH_TOKEN` for `api.github.com` requests and (b) add a bounded retry around
 * transient failures. The code path under test is unchanged and still hits the
 * real API; we only augment the outgoing request exactly as an authenticated
 * browser session would. The default Actions `${{ github.token }}` (read-only,
 * ~1,000 req/hr) is plenty for public repos.
 *
 * USAGE
 * -----
 *   node scripts/smoke-real-repos.mjs              # smoke every TARGET_REPOS entry
 *   node scripts/smoke-real-repos.mjs --repo owner/repo   # smoke a single repo
 *   SMOKE_REPO=owner/repo node scripts/smoke-real-repos.mjs
 *
 * Env knobs: GH_TOKEN | GITHUB_TOKEN (auth), SMOKE_REPO (single repo),
 * SMOKE_LOG (JSON log path), SMOKE_ALLOW_TWIN=1 (permit a non-api.github.com
 * host, e.g. for local twin debugging — never set in the scheduled run).
 *
 * Exit code is non-zero if ANY target repo fails an invariant or hits an
 * unrecoverable API error, so a red run means "the real GitHub API path broke",
 * not "one transient blip".
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

// ── Editable target list ───────────────────────────────────────────────────
// `branch` falls back to `'main'` (there is no default-branch discovery), so
// set it explicitly for any repo whose default branch is not `main` (e.g.
// `master`). `path` opts a repo into authored-content ingestion. The `expect`
// flags gate the per-repo (non-universal) invariants — set a flag true only
// when that family is STABLY present, so the assertion can't go flaky.
const TARGET_REPOS = [
  {
    owner: 'anokye-labs', repo: 'kbexplorer', branch: 'main', path: 'content',
    note: 'canonical default target; tiny; authored content + config path',
    expect: { readme: true, issues: true, releases: false },
  },
  {
    owner: 'anokye-labs', repo: 'kbexplorer-template', branch: 'main',
    note: 'our own repo; richest self-host shape incl. .github structural fan-out',
    expect: { readme: true, issues: true, releases: true },
  },
  {
    owner: 'sindresorhus', repo: 'slugify', branch: 'main',
    note: 'external org; stable releases; lowercase readme.md ⇒ no readme node',
    expect: { readme: false, issues: true, releases: true },
  },
  {
    owner: 'github', repo: 'scripts-to-rule-them-all', branch: 'master',
    note: 'external, archived, master default, zero issues (empty-family tolerance)',
    expect: { readme: true, issues: false, releases: false },
  },
];

const API_HOST = 'api.github.com';
const MAX_FETCH_ATTEMPTS = 4;            // 1 try + 3 retries
const RETRY_BASE_DELAY_MS = 400;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const allowTwin = process.env.SMOKE_ALLOW_TWIN === '1';
const logPath = process.env.SMOKE_LOG || resolve(root, 'cross-real-repo-smoke.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Per-repo transport-level health, reset before each repo's load. */
function freshStats() {
  return { requests: 0, retries: 0, rateLimited: 0, serverErrors: 0, networkErrors: 0, hosts: {} };
}
let stats = freshStats();

/** Is this a secondary/abuse rate-limit response (403/429 asking us to wait)? */
function isSecondaryRateLimit(res) {
  if (res.status === 429) return true;
  // GitHub signals a secondary/abuse limit with a 403 carrying a Retry-After
  // hint. (We deliberately don't body-sniff: that needs res.clone() + async and
  // the status/Retry-After signal is sufficient for a bounded retry.)
  if (res.status === 403 && res.headers.get('Retry-After')) return true;
  return false;
}
/** Is this a primary rate-limit exhaustion (403 with remaining=0)? */
function isPrimaryRateLimit(res) {
  return res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0';
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
  let host = '';
  try { host = new URL(url).host; } catch { /* opaque */ }

  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
  if (token && host === API_HOST && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  stats.requests++;
  if (host) stats.hosts[host] = (stats.hosts[host] || 0) + 1;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await realFetch(url, { ...init, headers });
      const retryable = RETRYABLE_STATUS.has(res.status) || isSecondaryRateLimit(res);
      if (retryable && attempt < MAX_FETCH_ATTEMPTS) {
        stats.retries++;
        const retryAfter = Number(res.headers.get('Retry-After'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      // Record unrecoverable transport-health problems (404/304 are normal and
      // ignored). Scope health to api.github.com ONLY: a third-party provider
      // host (e.g. en.wikipedia.org via the template's WikipediaProvider) having
      // a hiccup must NOT red the GitHub-path smoke.
      if (host === API_HOST) {
        if (isPrimaryRateLimit(res)) stats.rateLimited++;
        else if (res.status >= 500) stats.serverErrors++;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_FETCH_ATTEMPTS) {
        stats.retries++;
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }
      if (host === API_HOST) stats.networkErrors++;
      throw err;
    }
  }
  throw lastErr;
};

// ── Invariant checks ───────────────────────────────────────────────────────
/** A loopback / mock host is the tell-tale of a GitHub *twin*, not the real API. */
function isLoopbackHost(host) {
  return /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?)(:|$)/i.test(host);
}

function checkRepo(graph, getHubNodeId, expect, repoStats) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const issueNodes = graph.nodes.filter((n) => n.source?.type === 'issue').length;
  const releaseNodes = graph.nodes.filter((n) => n.source?.type === 'release').length;
  const hub = getHubNodeId(graph);
  const hosts = Object.keys(repoStats.hosts);

  const failures = [];
  // Universal invariants — these prove the real API path produced a sane graph.
  if (graph.nodes.length === 0) failures.push('graph has no nodes');
  if (graph.edges.length === 0) failures.push('graph has no edges');
  if (!hub) failures.push('no hub node (graph is unreachable / all-orphans)');
  if (!ids.has('repo-root')) failures.push("no 'repo-root' node (file tree not ingested)");
  // Real-API proof: every repo load MUST contact api.github.com, and never a
  // loopback/twin host (that would mean the GitHub calls were redirected to a
  // mock/Gitea adapter via VITE_GH_API_BASE).
  if (!allowTwin) {
    if (!(API_HOST in repoStats.hosts)) failures.push(`no ${API_HOST} requests — the GitHub API path may be pointed at a twin`);
    const twinHosts = hosts.filter(isLoopbackHost);
    if (twinHosts.length > 0) failures.push(`loopback/twin host(s) contacted: ${twinHosts.join(', ')} (set SMOKE_ALLOW_TWIN=1 to permit)`);
  }
  // Per-repo expectations — only asserted where the family is stably present.
  if (expect.readme && !ids.has('readme')) failures.push("expected a 'readme' node (README.md not ingested)");
  if (expect.issues && issueNodes < 1) failures.push('expected ≥1 issue node (issues not ingested)');
  if (expect.releases && releaseNodes < 1) failures.push('expected ≥1 release node (releases not ingested)');
  // Transport health (GitHub only) — distinguishes "API path broke" from "shape changed".
  if (repoStats.rateLimited > 0) failures.push(`rate-limited ${repoStats.rateLimited}× even with a token — increase the budget or trim TARGET_REPOS`);
  if (repoStats.serverErrors > 0) failures.push(`${repoStats.serverErrors} GitHub 5xx response(s) survived retries`);
  if (repoStats.networkErrors > 0) failures.push(`${repoStats.networkErrors} GitHub network error(s) survived retries`);

  return {
    failures,
    metrics: { nodes: graph.nodes.length, edges: graph.edges.length, hub, repoRoot: ids.has('repo-root'), readme: ids.has('readme'), issueNodes, releaseNodes },
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const argRepo = (() => {
    const i = process.argv.indexOf('--repo');
    return i >= 0 ? process.argv[i + 1] : (process.env.SMOKE_REPO || '');
  })();

  let repos = TARGET_REPOS;
  if (argRepo) {
    const want = argRepo.trim().toLowerCase();
    repos = TARGET_REPOS.filter((r) => `${r.owner}/${r.repo}`.toLowerCase() === want);
    if (repos.length === 0) {
      // Allow ad-hoc single-repo smoke of a repo not in the curated list.
      const [owner, repo] = argRepo.split('/');
      if (owner && repo) repos = [{ owner, repo, branch: undefined, note: 'ad-hoc --repo target', expect: { readme: false, issues: false, releases: false } }];
    }
    if (repos.length === 0) {
      console.error(`✗ --repo "${argRepo}" did not match TARGET_REPOS and is not in owner/repo form.`);
      process.exit(2);
    }
  }

  if (!token) {
    console.warn('⚠  No GH_TOKEN/GITHUB_TOKEN set — using UNAUTHENTICATED api.github.com (60 req/hr).');
    console.warn('   Fine for a single tiny repo locally; the scheduled run always passes the workflow token.');
  }

  const server = await createServer({
    root,
    configFile: false,                 // bypass the app's react/manifest plugins; SSR-load the engine directly
    logLevel: 'error',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });

  const results = [];
  try {
    const { loadRemoteKnowledgeBase } = await server.ssrLoadModule('/src/engine/remote-loader.ts');
    const { getHubNodeId } = await server.ssrLoadModule('/src/engine/graph.ts');

    for (const r of repos) {
      const slug = `${r.owner}/${r.repo}`;
      const source = { owner: r.owner, repo: r.repo, branch: r.branch ?? 'main', ...(r.path ? { path: r.path } : {}) };
      stats = freshStats();
      const started = Date.now();
      console.log(`\n▶ ${slug}@${source.branch}${r.note ? `  — ${r.note}` : ''}`);

      let entry;
      try {
        const { graph } = await loadRemoteKnowledgeBase(source, 'standard');
        const repoStats = stats;
        const { failures, metrics } = checkRepo(graph, getHubNodeId, r.expect ?? {}, repoStats);
        entry = { repo: slug, branch: source.branch, ok: failures.length === 0, failures, metrics, transport: repoStats, ms: Date.now() - started };
        const hostList = Object.entries(repoStats.hosts).map(([h, n]) => `${h}×${n}`).join(', ') || '(none)';
        console.log(`  nodes=${metrics.nodes} edges=${metrics.edges} hub=${metrics.hub} repoRoot=${metrics.repoRoot} readme=${metrics.readme} issues=${metrics.issueNodes} releases=${metrics.releaseNodes}`);
        console.log(`  fetches: ${repoStats.requests} (retries=${repoStats.retries}) → ${hostList}`);
        if (entry.ok) console.log(`  ✓ PASS (${entry.ms}ms)`);
        else { console.error(`  ✗ FAIL (${entry.ms}ms):`); for (const f of failures) console.error(`     - ${f}`); }
      } catch (err) {
        entry = { repo: slug, branch: source.branch, ok: false, failures: [`loadRemoteKnowledgeBase threw: ${err?.message || err}`], metrics: null, transport: stats, ms: Date.now() - started };
        console.error(`  ✗ FAIL — loader threw: ${err?.stack || err}`);
      }
      results.push(entry);
    }
  } finally {
    await server.close();
  }

  // Hosts contacted across the run — listed for transparency. The per-repo
  // checks already assert api.github.com was hit and no loopback/twin host was
  // used; third-party provider hosts (e.g. en.wikipedia.org) are expected.
  const allHosts = new Set(results.flatMap((r) => Object.keys(r.transport?.hosts ?? {})));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    apiHost: API_HOST,
    authenticated: Boolean(token),
    hostsContacted: [...allHosts],
    total: results.length,
    passed,
    failed: failed.length,
    results,
  };
  try { writeFileSync(logPath, JSON.stringify(summary, null, 2)); console.log(`\nWrote ${logPath}`); } catch (e) { console.warn(`Could not write log: ${e?.message || e}`); }

  console.log(`\n── Cross-real-repo smoke: ${passed}/${results.length} passed; hosts contacted: ${[...allHosts].join(', ') || '(none)'} ──`);
  if (failed.length > 0) {
    console.error(`✗ ${failed.length} target(s) failed: ${failed.map((r) => r.repo).join(', ')}`);
    console.error('  A red run means the REAL GitHub API path (github.ts → GitHubApiSource → loadKnowledgeBase) regressed,');
    console.error('  or a target repo legitimately changed shape (update its expect flags) — inspect the per-repo failures above.');
    process.exit(1);
  }
  console.log('✓ All target repositories produced a sane KBGraph over the live GitHub API.');
}

main().catch((err) => {
  console.error('Fatal:', err?.stack || err);
  process.exit(1);
});
