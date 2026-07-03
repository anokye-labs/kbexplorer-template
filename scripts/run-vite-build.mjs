import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync('npx', ['vite', 'build'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_KB_LOCAL: 'true',
  },
  shell: true,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
