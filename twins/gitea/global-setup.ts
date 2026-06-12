import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Playwright globalSetup for the Gitea DTU: bring up Podman+Gitea and seed the
 * baseline universe before any spec runs. Both steps are idempotent, so a warm
 * environment reconciles quickly. Runs the harness scripts as child processes so
 * their logging and error handling are reused verbatim.
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
}
