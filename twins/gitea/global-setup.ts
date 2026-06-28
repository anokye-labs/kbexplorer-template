import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Playwright globalSetup for the Gitea DTU: generate the local-mode manifest
 * module, then bring up Podman+Gitea and seed the baseline universe before any
 * spec runs. All steps are idempotent, so a warm environment reconciles quickly.
 * Runs the harness scripts as child processes so their logging and error
 * handling are reused verbatim.
 */
export default async function globalSetup() {
  const root = process.cwd();
  const run = (label: string, ...segments: string[]) => {
    console.log(`\n[dtu:setup] node ${label}`);
    execFileSync(process.execPath, [resolve(root, ...segments)], {
      stdio: 'inherit',
      env: process.env,
    });
  };

  // Generate src/generated/repo-manifest.json BEFORE the webServers start.
  // playwright.gitea.config.ts serves a bare `vite` dev server (no `prebuild`
  // step), and src/engine/local-loader.ts statically imports
  // `../generated/repo-manifest.json`, which Vite's import-analysis resolves at
  // transform time. That file is gitignored and is produced only by
  // scripts/generate-manifest.js (normally via the `prebuild` npm script before
  // `vite build`). In a fresh CI checkout it is therefore absent, so the dev
  // server 500s on import resolution and the app never boots — failing every
  // gitea spec. Generating it here satisfies Vite's resolver. The app stays in
  // REMOTE mode (no VITE_KB_LOCAL), so the manifest is never consumed at runtime;
  // its sole purpose is to make the static import resolvable. The output is
  // gitignored, so it does not affect seed.mjs's `git add -A` snapshot.
  run('scripts/generate-manifest.js', 'scripts', 'generate-manifest.js');

  run('twins/gitea/bootstrap.mjs', 'twins', 'gitea', 'bootstrap.mjs');
  run('twins/gitea/seed.mjs', 'twins', 'gitea', 'seed.mjs');
}
