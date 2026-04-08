#!/usr/bin/env node

/**
 * Dev server launcher for kbexplorer when used as a submodule.
 * Sets VITE_ENV_DIR to the host repo root so Vite loads .env.kbexplorer from there.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbRoot = resolve(__dirname, '..');
const hostRoot = resolve(kbRoot, '..', '..');

const isSubmodule = kbRoot !== hostRoot && !kbRoot.endsWith(resolve(hostRoot));

const envDir = isSubmodule ? hostRoot : kbRoot;

const child = spawn('npx', ['vite', '--open', ...process.argv.slice(2)], {
  cwd: kbRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_ENV_DIR: envDir },
});

child.on('exit', (code) => process.exit(code ?? 0));
