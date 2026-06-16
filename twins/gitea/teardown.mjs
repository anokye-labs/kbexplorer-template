#!/usr/bin/env node
/**
 * Tear down the Gitea Digital Twin.
 *
 *   node twins/gitea/teardown.mjs            # stop the container (keep data + token)
 *   node twins/gitea/teardown.mjs --rm       # stop + remove the container
 *   node twins/gitea/teardown.mjs --purge    # --rm and delete .dtu/ runtime state
 *
 * The podman machine (WSL VM) is left running — it is shared infrastructure and
 * cheap to keep warm; stopping it is out of scope for the harness.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { HARNESS, DTU_DIR } from './state.mjs';

const PODMAN = process.env.PODMAN_BIN ?? 'podman';
const args = process.argv.slice(2);
const doRm = args.includes('--rm') || args.includes('--purge');
const doPurge = args.includes('--purge');

function podman(a) {
  try { return execFileSync(PODMAN, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (err) { return (err.stdout ?? '') + (err.stderr ?? ''); }
}

console.log(`[teardown] stopping container "${HARNESS.container}"`);
podman(['stop', HARNESS.container]);
if (doRm) {
  console.log(`[teardown] removing container "${HARNESS.container}"`);
  podman(['rm', '-f', HARNESS.container]);
}
if (doPurge && existsSync(DTU_DIR)) {
  console.log(`[teardown] purging ${DTU_DIR}`);
  rmSync(DTU_DIR, { recursive: true, force: true });
}
console.log('[teardown] done ✅');
