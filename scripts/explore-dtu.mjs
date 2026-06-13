#!/usr/bin/env node
/**
 * Exploratory-agent harness — stage the DTU and emit a session brief.
 *
 * WHAT THIS SCRIPT DOES
 * ─────────────────────
 * 1. Brings the Gitea DTU up (bootstrap → seed → starts the adapter in the
 *    background).
 * 2. Starts the kbexplorer app with `vite dev` pointed at the adapter (dev,
 *    not preview — VITE_GH_API_BASE is inlined at build time, so only a dev
 *    server honours the runtime twin URL; see Step 3 for the full rationale).
 * 3. Waits for both servers to pass their health/readiness checks.
 * 4. Prints a ready-to-paste probing prompt for the orchestrator / agent session.
 * 5. Optionally writes a machine-readable `session-brief.json` to `.dtu/`.
 *
 * WHAT THIS SCRIPT DOES NOT DO
 * ────────────────────────────
 * • It does NOT call any LLM or start any agent session.  The harness is the
 *   scaffolding; the orchestrator (GitHub Actions, a human, or a CI caller)
 *   reads the brief and launches the session externally.
 * • It does NOT run Playwright specs.  Specs are written by agents and land
 *   through human-reviewed PRs (the holdout rule).
 * • It does NOT commit anything.
 *
 * BOUNDARY NOTE
 * ─────────────
 * The dtu:up / dtu:seed steps require **Podman** (not Docker).  On a developer
 * workstation with Podman installed the script runs end-to-end.  In a CI
 * environment without Podman (or when Podman is headless and the machine cannot
 * be started) the DTU bringup steps will fail with a clear error.  The script
 * documents this boundary via EXPLORE_SKIP_DTU=1 (see below).
 *
 * ENVIRONMENT VARIABLES
 * ─────────────────────
 * EXPLORE_SKIP_DTU=1        Skip dtu:up + dtu:seed (useful when the DTU is
 *                           already up, or in unit tests).  The adapter + app
 *                           still start; endpoints are derived from env / the
 *                           defaults below (GITEA_HTTP_PORT, EXPLORE_*_PORT),
 *                           NOT read from a state file.
 * EXPLORE_NO_APP=1          Skip the Vite app step (adapter-only staging).
 * EXPLORE_WRITE_BRIEF       Write .dtu/session-brief.json.  Defaults ON under
 *                           CI ($GITHUB_STEP_SUMMARY set); set =0 to force off.
 * EXPLORE_ADAPTER_PORT      Override the adapter port (default: TWIN_PORT / 3456).
 * EXPLORE_APP_PORT          Override the app port (default: 4319).
 *
 * Usage:  node scripts/explore-dtu.mjs
 *         npm run explore:dtu
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ─── Config ──────────────────────────────────────────────────────────────────

const ADAPTER_PORT = Number(process.env.EXPLORE_ADAPTER_PORT ?? process.env.TWIN_PORT ?? 3456);
const APP_PORT = Number(process.env.EXPLORE_APP_PORT ?? 4319);
const GITEA_PORT = Number(process.env.GITEA_HTTP_PORT ?? 3000);

const SKIP_DTU = process.env.EXPLORE_SKIP_DTU === '1';
const NO_APP = process.env.EXPLORE_NO_APP === '1';
// Write a brief when asked, or by default under GitHub Actions — but an
// explicit EXPLORE_WRITE_BRIEF=0 always wins, so CI can opt out.
const WRITE_BRIEF = process.env.EXPLORE_WRITE_BRIEF === '0'
  ? false
  : process.env.EXPLORE_WRITE_BRIEF === '1' || Boolean(process.env.GITHUB_STEP_SUMMARY);

const GITEA_API = process.env.GITEA_API ?? `http://localhost:${GITEA_PORT}`;
const ADAPTER_URL = `http://localhost:${ADAPTER_PORT}`;
const APP_URL = `http://localhost:${APP_PORT}`;

const DTU_DIR = resolve(REPO_ROOT, '.dtu');
const BRIEF_PATH = resolve(DTU_DIR, 'session-brief.json');

/** KB repo coords for the probing prompt (overridable via env). */
const KB_OWNER = process.env.KB_OWNER ?? 'anokye-labs';
const KB_REPO = process.env.KB_REPO ?? 'kbexplorer-template';
const KB_BRANCH = process.env.KB_BRANCH ?? 'main';

// Processes spawned by this harness (kept alive until Ctrl-C / parent exits).
const children = [];

function log(msg) { console.log(`[explore-dtu] ${msg}`); }
function warn(msg) { console.warn(`[explore-dtu] WARN: ${msg}`); }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Run a one-shot npm script synchronously, streaming its output. */
function runScript(script) {
  log(`running npm run ${script}…`);
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npmCmd, ['run', script], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
}

/**
 * Spawn a long-lived background process (e.g. the adapter server or Vite).
 * Returns the ChildProcess; process is registered for cleanup on exit.
 */
function spawnBackground(label, cmd, args, env = {}) {
  log(`spawning ${label}…`);
  const child = spawn(cmd, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('error', (err) => warn(`${label} process error: ${err.message}`));
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) warn(`${label} exited with code ${code}`);
  });
  children.push(child);
  return child;
}

/** Poll a URL until it returns HTTP 2xx or 30 seconds elapse. */
async function waitForUrl(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || (res.status >= 300 && res.status < 400)) {
        log(`${label} is ready at ${url}`);
        return true;
      }
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  warn(`${label} did not become ready within ${timeoutMs / 1000}s (${url})`);
  return false;
}

/** Clean up background children on exit. */
function setupCleanup() {
  const kill = () => {
    for (const c of children) {
      try { c.kill('SIGTERM'); } catch { /* already dead */ }
    }
  };
  process.on('SIGINT', () => { kill(); process.exit(0); });
  process.on('SIGTERM', () => { kill(); process.exit(0); });
  process.on('exit', kill);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  setupCleanup();

  // ── Step 1: Bring the DTU up ────────────────────────────────────────────
  if (SKIP_DTU) {
    warn('EXPLORE_SKIP_DTU=1 — skipping dtu:up + dtu:seed. DTU must already be running.');
  } else {
    log('--- Step 1: Bootstrap Gitea DTU ---');
    log('NOTE: This requires Podman. On CI (ubuntu-latest) Podman is available natively.');
    log('      On macOS/Windows a Podman machine must be installed first.');
    log('      Set EXPLORE_SKIP_DTU=1 to skip if the DTU is already up.');
    runScript('dtu:up');
    runScript('dtu:seed');
  }

  // ── Step 2: Start the adapter in the background ─────────────────────────
  log('--- Step 2: Start the GitHub→Gitea adapter ---');
  spawnBackground('adapter', 'node', ['twins/gitea/server.mjs'], {
    TWIN_PORT: String(ADAPTER_PORT),
  });
  const adapterReady = await waitForUrl(`${ADAPTER_URL}/health`, 'adapter');

  // ── Step 3: Start the app (unless opted out) ─────────────────────────────
  let appReady = false;
  if (NO_APP) {
    warn('EXPLORE_NO_APP=1 — skipping Vite app. Probe the adapter directly.');
  } else {
    log('--- Step 3: Start kbexplorer app (Vite dev) ---');
    // MUST use `vite dev`, never `vite preview`. The app reads the twin URL
    // from `import.meta.env.VITE_GH_API_BASE` (src/api/github.ts), which Vite
    // INLINES at build time. A prebuilt dist/ therefore bakes in whatever base
    // was set during `vite build` and silently ignores VITE_GH_API_BASE passed
    // at preview time — the app would come up "ready" but pointed at the wrong
    // backend, defeating the harness. `vite dev` evaluates env at serve time,
    // so the runtime injection below actually takes effect.
    // Use `npm exec` so the vite bin resolves on all platforms (a direct node
    // invocation of the .bin shim fails on Windows — the shim is a bash script).
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    spawnBackground('app', npmCmd, ['exec', '--', 'vite', 'dev', '--port', String(APP_PORT), '--strictPort'], {
      VITE_GH_API_BASE: ADAPTER_URL,
      VITE_KB_OWNER: KB_OWNER,
      VITE_KB_REPO: KB_REPO,
      VITE_KB_BRANCH: KB_BRANCH,
      VITE_KB_LOCAL: 'false',
    });
    appReady = await waitForUrl(APP_URL, 'app');
  }

  // ── Step 4: Build and emit the session brief ─────────────────────────────
  const brief = {
    generatedAt: new Date().toISOString(),
    endpoints: {
      app: NO_APP ? null : APP_URL,
      adapter: ADAPTER_URL,
      gitea: GITEA_API,
    },
    ready: {
      adapter: adapterReady,
      app: NO_APP ? null : appReady,
    },
    repo: { owner: KB_OWNER, repo: KB_REPO, branch: KB_BRANCH },
    actorsDir: 'twins/gitea/actors/',
    specsDir: 'e2e/gitea/',
    holdoutRule: 'Assertions live in e2e/gitea/ specs only — never inside the twin. Agent-authored specs land through human-reviewed PRs, never auto-committed.',
    probingPrompt: buildProbingPrompt({ adapterReady, appReady }),
  };

  if (WRITE_BRIEF) {
    if (!existsSync(DTU_DIR)) {
      // DTU dir may not exist if EXPLORE_SKIP_DTU=1 and nothing created it.
      const { mkdirSync } = await import('node:fs');
      mkdirSync(DTU_DIR, { recursive: true });
    }
    writeFileSync(BRIEF_PATH, JSON.stringify(brief, null, 2));
    log(`session brief written → ${BRIEF_PATH}`);
  }

  // ── Step 5: Print the brief to stdout (always) ───────────────────────────
  printBrief(brief);

  // ── Step 6: Write to GitHub Actions job summary if available ─────────────
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(summaryPath, buildMarkdownSummary(brief));
    log('job summary written');
  }

  log('--- DTU staged. Press Ctrl-C to stop the background servers. ---');
  // Keep the process alive so the background servers stay up.
  await new Promise(() => {}); // wait forever
}

// ─── Output helpers ───────────────────────────────────────────────────────────

function buildProbingPrompt({ adapterReady, appReady }) {
  const appLine = appReady
    ? `- **App** (kbexplorer, remote mode): ${APP_URL}`
    : `- **App**: not started (EXPLORE_NO_APP=1 or startup failed — start manually with:\n  VITE_GH_API_BASE=${ADAPTER_URL} VITE_KB_OWNER=${KB_OWNER} VITE_KB_REPO=${KB_REPO} VITE_KB_BRANCH=${KB_BRANCH} npm run dev)`;

  return `A live kbexplorer Digital Twin Universe (DTU) is running:

${appLine}
- **GitHub→Gitea adapter**: ${ADAPTER_URL} (status: ${adapterReady ? 'ready' : 'NOT READY — check logs'})
- **Gitea server** (source of truth): ${GITEA_API}

Repo coordinates mirrored in the twin: ${KB_OWNER}/${KB_REPO} @ ${KB_BRANCH}

## Your task

Use the scripted actors in \`twins/gitea/actors/\` (or \`npm run dtu:tea --\`) to
mutate the twin and verify the app reflects each change on refresh:

\`\`\`bash
# Open a new issue (appears as a work node after refresh):
node twins/gitea/actors/open-issue.mjs --title "My probe issue" --label bug

# Edit a source file and open a PR (proves the PR node + diff view):
node twins/gitea/actors/edit-source.mjs \\
  --path content-model/people/ben.yaml --set title="Staff Engineer"

# Merge a PR (advances main; README node updates on refresh):
node twins/gitea/actors/merge-pr.mjs --number <N> --style merge

# Interactive tea shell (Gitea's gh analogue):
npm run dtu:tea -- issues ls
\`\`\`

## Probe edge cases

Try:
- Rapid successive edits to the same file (cache invalidation under churn)
- Label changes on an existing issue (node metadata refresh)
- Concurrent PRs from different branches (ordering, deduplication)
- Merge races (two PRs targeting main in quick succession)
- Large payloads (many issues, deep pagination)
- 304 / ETag round-trips (open DevTools Network tab and watch for cached GETs)

## For each gap you find

Author a new \`e2e/gitea/*.spec.ts\` that reproduces it deterministically using
the actor helpers, then **open a PR** for human review.  Do NOT commit specs
directly to main.  Do NOT encode the assertion inside the twin — the twin
translates faithfully; specs measure the real app (the **holdout rule**).

See \`twins/gitea/README.md\` and \`DTU.md\` for the full harness reference.`;
}

function printBrief(brief) {
  console.log('\n' + '═'.repeat(72));
  console.log('  EXPLORATORY-AGENT SESSION BRIEF');
  console.log('═'.repeat(72));
  console.log(`  Generated : ${brief.generatedAt}`);
  console.log(`  App       : ${brief.endpoints.app ?? '(not started)'} [${brief.ready.app === null ? 'skipped' : brief.ready.app ? 'READY' : 'NOT READY'}]`);
  console.log(`  Adapter   : ${brief.endpoints.adapter} [${brief.ready.adapter ? 'READY' : 'NOT READY'}]`);
  console.log(`  Gitea     : ${brief.endpoints.gitea}`);
  console.log('═'.repeat(72));
  console.log('\n── PROBING PROMPT (paste into your agent session) ──\n');
  console.log(brief.probingPrompt);
  console.log('\n' + '═'.repeat(72) + '\n');
}

function buildMarkdownSummary(brief) {
  const appStatus = brief.ready.app === null ? 'skipped' : brief.ready.app ? '✅ ready' : '❌ not ready';
  const adapterStatus = brief.ready.adapter ? '✅ ready' : '❌ not ready';

  return `## Exploratory-agent session brief

| Component | URL | Status |
|-----------|-----|--------|
| App (kbexplorer) | ${brief.endpoints.app ?? '—'} | ${appStatus} |
| GitHub→Gitea adapter | ${brief.endpoints.adapter} | ${adapterStatus} |
| Gitea server | ${brief.endpoints.gitea} | (not polled) |

**Repo:** \`${brief.repo.owner}/${brief.repo.repo}\` @ \`${brief.repo.branch}\`

<details>
<summary>Probing prompt (expand to copy)</summary>

\`\`\`
${brief.probingPrompt}
\`\`\`

</details>

> **Holdout rule:** ${brief.holdoutRule}

Generated: ${brief.generatedAt}
`;
}

main().catch((err) => {
  console.error(`[explore-dtu] FATAL: ${err.message}`);
  process.exit(1);
});
