import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'

function manifestPlugin(): Plugin {
  return {
    name: 'kbexplorer-manifest',
    buildStart() {
      if (process.env.VITE_KB_LOCAL !== 'true') return;
      // VITE_KB_SKIP_REGEN=1 lets a pre-generated manifest (e.g. from the
      // full-loop globalSetup via the CLI's DTU-aware generator) survive Vite's
      // buildStart without being overwritten by the local gh-CLI script.
      if (process.env.VITE_KB_SKIP_REGEN === '1') return;
      try {
        execSync('node scripts/generate-manifest.js', { stdio: 'inherit' });
      } catch (err) {
        console.warn('[kbexplorer] Manifest generation failed:', err);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [manifestPlugin(), react()],
  envDir: process.env.VITE_ENV_DIR ?? process.cwd(),
})
