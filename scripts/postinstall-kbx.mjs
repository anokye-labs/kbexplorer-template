#!/usr/bin/env node
/**
 * postinstall-kbx.mjs — build the vendored `@anokye-labs/kbx` CLI dependency
 * (anokye-labs/kbexplorer-template#511).
 *
 * `@anokye-labs/kbx` is pinned via a git URL (see the `devDependencies` entry
 * in package.json) and its `bin/kbx.js` entrypoint imports the compiled
 * `dist/cli.js`. Unlike this repo's other git-pinned deps
 * (`@anokye-labs/kbexplorer-engine` et al.), the CLI package does not ship a
 * `prepare` script, so npm's normal "build git dependencies on install" step
 * never runs for it — a plain `npm install` leaves `node_modules/@anokye-labs/
 * kbx` as raw TypeScript source with no `dist/`, and the `kbx` bin fails with
 * `ERR_MODULE_NOT_FOUND`. (Tracked upstream: kbexplorer-cli should add a
 * `"prepare": "npm run build"` script so this workaround can be deleted.)
 *
 * Until that upstream fix lands, this postinstall step builds it in place:
 * installs its devDependencies (tsup, typescript) into its own nested
 * node_modules, then runs its `build` script.
 *
 * Idempotent: skipped when `dist/cli.js` already exists (an unchanged
 * dependency pin reuses the already-built copy on repeat installs) and a
 * no-op when the dependency isn't installed at all (e.g. a pruned/production
 * install).
 */
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kbxDir = resolve(repoRoot, 'node_modules', '@anokye-labs', 'kbx');
const kbxDist = resolve(kbxDir, 'dist', 'cli.js');

if (!existsSync(kbxDir) || existsSync(kbxDist)) {
  process.exit(0);
}

console.log('[postinstall] Building @anokye-labs/kbx (no `prepare` script upstream — see scripts/postinstall-kbx.mjs)…');
// Use execSync (always shell-mediated) with quoted paths rather than
// execFileSync('npm.cmd', …): on Windows + Node >= 20.12, spawning a `.cmd`
// without a shell throws EINVAL (CVE-2024-27980 mitigation), which broke
// `npm install`/`npm ci` for every Windows contributor. Shelling out keeps the
// `.cmd` resolvable and the quotes keep paths with spaces intact cross-platform.
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const q = (s) => `"${s}"`;
execSync(`${npmCmd} install --no-audit --no-fund --prefix ${q(kbxDir)}`, { stdio: 'inherit' });
execSync(`${npmCmd} run build --prefix ${q(kbxDir)}`, { stdio: 'inherit' });
console.log('[postinstall] @anokye-labs/kbx built.');
