/**
 * Shared helpers for the Gitea DTU harness: locate the repo root, read/write the
 * gitignored `.dtu/state.json` connection file, and expose harness config from
 * env with sensible defaults.
 *
 * `.dtu/state.json` holds the live Gitea coordinates + admin token. It is the
 * single source of truth that decouples bootstrap (which mints the token) from
 * the adapter server, seed script, and actors — so process start order never
 * matters. The token lives ONLY here and in process env; it is never shipped to
 * the browser (the adapter is a server-side proxy) and `.dtu/` is gitignored.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..', '..');
export const DTU_DIR = resolve(REPO_ROOT, '.dtu');
export const STATE_FILE = resolve(DTU_DIR, 'state.json');
export const BIN_DIR = resolve(DTU_DIR, 'bin');

/** Harness-wide defaults, overridable via env. */
export const HARNESS = {
  giteaApi: process.env.GITEA_API ?? 'http://localhost:3000',
  container: process.env.GITEA_CONTAINER ?? 'kbe-gitea',
  // Pinned to the 1.24 minor so the harness tracks security/bugfix patches within
  // a known-good major.minor without surprise behavior jumps across majors. The
  // pulls/issues REST surface the harness uses is stable across 1.24.x. Override
  // via GITEA_IMAGE to reproduce against a specific patch if drift is suspected.
  image: process.env.GITEA_IMAGE ?? 'docker.io/gitea/gitea:1.24',
  httpPort: Number(process.env.GITEA_HTTP_PORT ?? 3000),
  twinPort: Number(process.env.TWIN_PORT ?? 3456),
  admin: {
    username: process.env.GITEA_ADMIN_USER ?? 'kbadmin',
    password: process.env.GITEA_ADMIN_PASSWORD ?? 'kbpassw0rd!',
    email: process.env.GITEA_ADMIN_EMAIL ?? 'kbadmin@example.com',
  },
  owner: process.env.KB_OWNER ?? 'anokye-labs',
  repo: process.env.KB_REPO ?? 'kbexplorer-template',
  branch: process.env.KB_BRANCH ?? 'main',
};

export function ensureDtuDir() {
  if (!existsSync(DTU_DIR)) mkdirSync(DTU_DIR, { recursive: true });
  if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });
}

/** Read `.dtu/state.json`, or `null` when it does not exist yet. */
export function readState() {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/** Merge-write the state file (creates `.dtu/` as needed). */
export function writeState(patch) {
  ensureDtuDir();
  const current = readState() ?? {};
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

/**
 * Resolve the Gitea coords/token the adapter should use, preferring env, then
 * the on-disk state file. Returns `{ giteaApi, token }` (token may be empty).
 */
export function resolveGiteaConfig() {
  const state = readState() ?? {};
  return {
    giteaApi: process.env.GITEA_API ?? state.giteaApi ?? HARNESS.giteaApi,
    token: process.env.GITEA_TOKEN ?? state.token ?? '',
  };
}
