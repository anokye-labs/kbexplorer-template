import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Playwright globalSetup for the Gitea DTU: bring up Podman+Gitea, seed the
 * baseline universe, then ensure a stub manifest exists — all before any spec
 * runs. The harness steps are idempotent, so a warm environment reconciles
 * quickly. Runs the harness scripts as child processes so their logging and
 * error handling are reused verbatim.
 */
export default async function globalSetup() {
  const root = process.cwd();
  const run = (script: string) => {
    console.log(`\n[dtu:setup] node ${script}`);
    execFileSync(process.execPath, [resolve(root, 'twins', 'gitea', script)], {
      stdio: 'inherit',
      env: process.env,
    });
  };
  run('bootstrap.mjs');
  run('seed.mjs');
  ensureStubManifest(root);
}

/**
 * Write a minimal STUB `src/generated/repo-manifest.json` so Vite's
 * import-analysis can resolve the static `import('../generated/repo-manifest.json')`
 * in src/engine/local-loader.ts.
 *
 * Why this is needed: playwright.gitea.config.ts serves the app with a bare
 * `vite` dev server (no `prebuild` step). That import is resolved by Vite at
 * transform time regardless of mode; the file is gitignored and normally only
 * produced by scripts/generate-manifest.js, so in a fresh CI checkout it is
 * absent and the dev server 500s on import resolution — the app never boots and
 * every gitea spec fails.
 *
 * Why a STUB (not running generate-manifest.js): L3 runs the app in REMOTE mode
 * (the config sets VITE_GH_API_BASE and does NOT set VITE_KB_LOCAL), so the app
 * sources everything from the live Gitea twin and NEVER reads this manifest at
 * runtime. The file only needs to EXIST as valid JSON to satisfy the resolver,
 * so a stub keeps the harness fully offline (no GitHub/`gh` calls).
 *
 * Idempotent: written only when absent, so a real local-mode manifest (e.g. from
 * `prebuild`) is never clobbered. The path is gitignored (src/generated/.gitignore),
 * so it never enters the seed's `git add -A` snapshot — writing it after seed is
 * belt-and-suspenders on top of that.
 */
function ensureStubManifest(root: string) {
  const manifestPath = resolve(root, 'src', 'generated', 'repo-manifest.json');
  if (existsSync(manifestPath)) return;
  mkdirSync(dirname(manifestPath), { recursive: true });
  // Minimal RepoManifest — only the required (non-optional) fields of the
  // interface in src/engine/local-loader.ts. Contents are irrelevant in remote
  // mode; this exists solely so the static import resolves.
  const stub = {
    configRaw: null,
    authoredContent: {},
    tree: [],
    readme: null,
    issues: [],
    pullRequests: [],
    commits: [],
    generatedAt: '',
  };
  writeFileSync(manifestPath, `${JSON.stringify(stub, null, 2)}\n`, 'utf-8');
  console.log(`[dtu:setup] wrote stub repo-manifest.json → ${manifestPath}`);
}
