#!/usr/bin/env node
/**
 * Bootstrap a local Gitea Digital Twin via **Podman** (no Docker).
 *
 * Idempotent + resumable: re-running reconciles to the desired state rather than
 * failing. Steps:
 *   1. Ensure the podman machine (Linux VM on Windows/macOS) is running.
 *   2. Pull the pinned Gitea image if missing.
 *   3. Run/reuse the Gitea container (SQLite, install pre-locked, headless).
 *   4. Wait for the Gitea API to answer.
 *   5. Create the admin user (idempotent).
 *   6. Mint a fresh API token (delete-then-create so we always hold the sha1).
 *   7. Persist coords + token to `.dtu/state.json` for the adapter/seed/actors.
 *
 * The token is written only to the gitignored `.dtu/` dir and never reaches the
 * browser — the adapter is a server-side proxy.
 *
 * Usage: node twins/gitea/bootstrap.mjs
 */
import { execFileSync } from 'node:child_process';
import { HARNESS, writeState } from './state.mjs';

const PODMAN = process.env.PODMAN_BIN ?? 'podman';

function podman(args, { ignoreError = false } = {}) {
  try {
    return execFileSync(PODMAN, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (ignoreError) return (err.stdout ?? '') + (err.stderr ?? '');
    const detail = (err.stderr ?? err.stdout ?? err.message ?? '').toString().trim();
    throw new Error(`podman ${args.join(' ')} failed: ${detail}`);
  }
}

function log(msg) { console.log(`[bootstrap] ${msg}`); }

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function ensureMachine() {
  // `podman info` succeeds only when the machine/connection is live.
  try {
    podman(['info', '--format', '{{.Host.Arch}}']);
    log('podman machine already running');
    return;
  } catch {
    log('starting podman machine…');
    podman(['machine', 'start'], { ignoreError: true });
    // Wait for the connection to come up.
    for (let i = 0; i < 30; i++) {
      try { podman(['info', '--format', '{{.Host.Arch}}']); log('podman machine running'); return; }
      catch { await sleep(2000); }
    }
    throw new Error('podman machine did not become ready');
  }
}

function ensureImage() {
  const have = podman(['images', '--format', '{{.Repository}}:{{.Tag}}'], { ignoreError: true });
  if (have.includes(HARNESS.image.replace('docker.io/', '')) || have.includes(HARNESS.image)) {
    log(`image present: ${HARNESS.image}`);
    return;
  }
  log(`pulling ${HARNESS.image} …`);
  podman(['pull', HARNESS.image]);
}

function ensureContainer() {
  const status = podman(['ps', '-a', '--filter', `name=^${HARNESS.container}$`, '--format', '{{.Status}}'], { ignoreError: true });
  if (/^Up/i.test(status)) { log(`container "${HARNESS.container}" already running`); return; }
  if (status) {
    log(`starting existing container "${HARNESS.container}"`);
    podman(['start', HARNESS.container]);
    return;
  }
  log(`running new Gitea container "${HARNESS.container}" on :${HARNESS.httpPort}`);
  podman([
    'run', '-d', '--name', HARNESS.container,
    '-p', `${HARNESS.httpPort}:3000`,
    '-e', 'GITEA__database__DB_TYPE=sqlite3',
    '-e', 'GITEA__security__INSTALL_LOCK=true',
    '-e', `GITEA__server__ROOT_URL=http://localhost:${HARNESS.httpPort}/`,
    '-e', 'GITEA__server__HTTP_PORT=3000',
    '-e', 'GITEA__server__SSH_DOMAIN=localhost',
    '-e', 'GITEA__server__DISABLE_SSH=true',
    '-e', 'GITEA__service__DISABLE_REGISTRATION=true',
    HARNESS.image,
  ]);
}

async function waitForApi() {
  const url = `${HARNESS.giteaApi}/api/v1/version`;
  log(`waiting for Gitea API at ${url} …`);
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { const v = await res.json(); log(`Gitea ${v.version} is up`); return; }
    } catch { /* not up yet */ }
    await sleep(2000);
  }
  throw new Error('Gitea API did not come up in time');
}

function ensureAdmin() {
  const out = podman([
    'exec', '-u', 'git', HARNESS.container,
    'gitea', 'admin', 'user', 'create',
    '--admin', '--username', HARNESS.admin.username,
    '--password', HARNESS.admin.password,
    '--email', HARNESS.admin.email,
    '--must-change-password=false',
  ], { ignoreError: true });
  if (/successfully created/i.test(out)) log(`admin user "${HARNESS.admin.username}" created`);
  else if (/already exists/i.test(out)) log(`admin user "${HARNESS.admin.username}" already exists`);
  else log(`admin user create output: ${out.trim() || '(none)'}`);
}

function basicAuth() {
  const pair = `${HARNESS.admin.username}:${HARNESS.admin.password}`;
  return 'Basic ' + Buffer.from(pair).toString('base64');
}

async function mintToken() {
  const base = `${HARNESS.giteaApi}/api/v1/users/${HARNESS.admin.username}/tokens`;
  const name = 'kbe-dtu';
  const auth = basicAuth();
  // Delete any prior token of this name so we always obtain a usable sha1.
  await fetch(`${base}/${name}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {});
  const res = await fetch(base, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      scopes: ['write:repository', 'write:issue', 'write:user', 'read:organization', 'write:organization'],
    }),
  });
  if (!res.ok) throw new Error(`token mint failed: ${res.status} ${await res.text()}`);
  const tok = await res.json();
  log(`minted API token "${name}"`);
  return tok.sha1;
}

async function main() {
  await ensureMachine();
  ensureImage();
  ensureContainer();
  await waitForApi();
  ensureAdmin();
  const token = await mintToken();
  const state = writeState({
    giteaApi: HARNESS.giteaApi,
    token,
    owner: HARNESS.owner,
    repo: HARNESS.repo,
    branch: HARNESS.branch,
    admin: { username: HARNESS.admin.username, password: HARNESS.admin.password },
    container: HARNESS.container,
  });
  log(`state written: ${state.giteaApi} (${state.owner}/${state.repo}@${state.branch})`);
  log('bootstrap complete ✅');
}

main().catch((err) => { console.error(`[bootstrap] FAILED: ${err.message}`); process.exit(1); });
