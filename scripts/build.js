#!/usr/bin/env node

/**
 * Production build launcher for kbexplorer when used as a submodule.
 * Sets VITE_ENV_DIR to the host repo root and outputs to the host's dist/kb directory.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbRoot = resolve(__dirname, '..');
const hostRoot = resolve(kbRoot, '..', '..');

const isSubmodule = kbRoot !== hostRoot && !kbRoot.endsWith(resolve(hostRoot));

const envDir = isSubmodule ? hostRoot : kbRoot;
const outDir = isSubmodule ? resolve(hostRoot, 'dist', 'kb') : resolve(kbRoot, 'dist');

const child = spawn(
  'npx',
  ['vite', 'build', '--outDir', outDir, '--emptyOutDir', ...process.argv.slice(2)],
  {
    cwd: kbRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_ENV_DIR: envDir },
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
