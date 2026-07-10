/**
 * Ensure a minimal STUB `src/generated/repo-manifest.json` exists so Vite's
 * import-analysis can resolve the static `import('../generated/repo-manifest.json')`
 * in src/engine/local-loader.ts.
 *
 * Run from the Vite webServer command in playwright.gitea.config.ts BEFORE the
 * dev server starts, so the module resolves on Vite's very first transform. This
 * placement is race-free: Playwright starts webServers concurrently with (in CI,
 * before) globalSetup, so writing the file in globalSetup leaves a transient
 * pre-transform error; chaining it ahead of `vite` in the webServer command
 * guarantees the file exists before Vite ever runs.
 *
 * L3 runs the app in REMOTE mode (the config sets VITE_GH_API_BASE and does NOT
 * set VITE_KB_LOCAL), so the app sources everything from the live Gitea twin and
 * NEVER reads this manifest at runtime — the file only needs to EXIST as valid
 * JSON. A static stub (rather than running `kbx manifest`) keeps
 * the harness fully offline and deterministic: no `gh`/GitHub calls, so no extra
 * network/CLI failure mode on the nightly lane.
 *
 * Idempotent: if the file already exists it is left untouched, so a real
 * local-mode manifest (e.g. from `prebuild`, for a dev running
 * `npm run test:e2e:gitea`) is never clobbered. The path is gitignored
 * (src/generated/.gitignore), so it never enters the seed's `git add -A` snapshot.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = resolve(repoRoot, 'src', 'generated', 'repo-manifest.json');

if (existsSync(manifestPath)) {
  console.log('[manifest-stub] src/generated/repo-manifest.json already present, leaving as-is');
} else {
  mkdirSync(dirname(manifestPath), { recursive: true });
  // Minimal valid RepoManifest — only the REQUIRED (non-optional) fields of the
  // interface in src/engine/local-loader.ts. Contents are irrelevant in remote
  // mode; this exists solely so the static import resolves.
  const stub = {
    generatedAt: '',
    configRaw: null,
    authoredContent: {},
    tree: [],
    readme: null,
    issues: [],
    pullRequests: [],
    commits: [],
  };
  writeFileSync(manifestPath, `${JSON.stringify(stub, null, 2)}\n`, 'utf-8');
  console.log('[manifest-stub] wrote src/generated/repo-manifest.json');
}
