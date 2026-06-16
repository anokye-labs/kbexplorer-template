#!/usr/bin/env node
/**
 * `tea` (Gitea's official CLI, the `gh` analogue) provisioning + thin wrapper.
 *
 * Downloads and caches the pinned `tea` binary under the gitignored `.dtu/bin/`,
 * configures a login that points at the DTU's Gitea using the token from
 * `.dtu/state.json`, and exposes a `runTea()` helper. The login config is kept
 * isolated under `.dtu/tea-config` (via XDG_CONFIG_HOME) so it never clobbers a
 * developer's real `tea` setup.
 *
 * This is the human-/agent-facing actor CLI for exploratory sessions:
 *   npm run dtu:tea -- issues ls
 *   npm run dtu:tea -- pulls create --head my-branch --base main --title "…"
 *
 * The committed, deterministic scenario actors (actors/*.mjs) drive Gitea via its
 * REST API for speed and to avoid a binary download on the fast path; `tea` is the
 * richer surface for interactive probing. Both hit the same live Gitea.
 *
 * Usage: node twins/gitea/tea.mjs [tea args…]
 *        node twins/gitea/tea.mjs --ensure        # just download + login, no command
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BIN_DIR, DTU_DIR, ensureDtuDir, readState, HARNESS } from './state.mjs';

const TEA_VERSION = process.env.TEA_VERSION ?? '0.14.1';

function platformAsset() {
  const plat = process.platform; // 'win32' | 'linux' | 'darwin'
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const os = plat === 'win32' ? 'windows' : plat === 'darwin' ? 'darwin' : 'linux';
  const ext = plat === 'win32' ? '.exe' : '';
  return { os, arch, ext, name: `tea-${TEA_VERSION}-${os}-${arch}${ext}` };
}

export function teaBinPath() {
  const { ext } = platformAsset();
  return resolve(BIN_DIR, `tea${ext}`);
}

const teaConfigDir = resolve(DTU_DIR, 'tea-config');

function teaEnv() {
  // Isolate tea's login store from the developer's real ~/.config/tea.
  return { ...process.env, XDG_CONFIG_HOME: teaConfigDir };
}

/** Download + cache the tea binary if not already present. */
export async function ensureTeaBinary() {
  ensureDtuDir();
  const bin = teaBinPath();
  if (existsSync(bin)) return bin;
  const { name } = platformAsset();
  const url = `https://dl.gitea.com/tea/${TEA_VERSION}/${name}`;
  console.log(`[tea] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tea download failed: ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import('node:fs');
  if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });
  writeFileSync(bin, buf);
  if (process.platform !== 'win32') chmodSync(bin, 0o755);
  console.log(`[tea] cached at ${bin} (${buf.length} bytes)`);
  return bin;
}

/** Configure a `kbe-dtu` login pointing at the running Gitea (idempotent). */
export function ensureTeaLogin() {
  const state = readState();
  if (!state || !state.token) {
    throw new Error('No .dtu/state.json token — run `node twins/gitea/bootstrap.mjs` first.');
  }
  const bin = teaBinPath();
  const env = teaEnv();
  mkdirSync(teaConfigDir, { recursive: true });
  // `tea login list` is cheap; if our login is present, we're done.
  try {
    const list = execFileSync(bin, ['login', 'list', '--output', 'simple'], { env, encoding: 'utf8' });
    if (list.includes('kbe-dtu')) return;
  } catch { /* no logins yet */ }
  execFileSync(bin, [
    'login', 'add',
    '--name', 'kbe-dtu',
    '--url', state.giteaApi ?? HARNESS.giteaApi,
    '--token', state.token,
  ], { env, stdio: 'inherit' });
  console.log('[tea] login "kbe-dtu" configured');
}

/** Run tea with the DTU login, returning stdout. */
export function runTea(args, { capture = true } = {}) {
  const bin = teaBinPath();
  const env = teaEnv();
  const full = args.includes('--login') ? args : [...args, '--login', 'kbe-dtu'];
  return execFileSync(bin, full, {
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

async function main() {
  const argv = process.argv.slice(2);
  await ensureTeaBinary();
  ensureTeaLogin();
  if (argv.length === 0 || argv[0] === '--ensure') {
    console.log(`[tea] ready: ${teaBinPath()}`);
    return;
  }
  // Default to operating on the DTU repo when a repo-scoped command omits --repo.
  const state = readState() ?? {};
  const repoFlag = state.owner && state.repo ? ['--repo', `${state.owner}/${state.repo}`] : [];
  const needsRepo = ['issues', 'issue', 'pulls', 'pull', 'pr'].includes(argv[0]) && !argv.includes('--repo');
  const args = needsRepo ? [...argv, ...repoFlag] : argv;
  try {
    process.stdout.write(runTea(args));
  } catch (err) {
    process.stderr.write((err.stdout ?? '') + (err.stderr ?? err.message ?? ''));
    process.exit(1);
  }
}

// Only run as a script (not when imported by actors).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('tea.mjs')) {
  main().catch((err) => { console.error(`[tea] FAILED: ${err.message}`); process.exit(1); });
}
