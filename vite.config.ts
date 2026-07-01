import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
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
  build: {
    rollupOptions: {
      // Two HTML entries: the full-page SPA (`index.html` → `main.tsx`) and the
      // additive embeddable canvas surface (`canvas.html` → `canvas.tsx`, #406).
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        canvas: fileURLToPath(new URL('./canvas.html', import.meta.url)),
      },
    },
  },
  envDir: process.env.VITE_ENV_DIR ?? process.cwd(),
  resolve: {
    alias: {
      // The pure `./lib` of @anokye-labs/kbexplorer-provider-rich-markdown
      // top-level-imports `node:crypto` (sync createHash) and `node:path`
      // (basename/extname). Those don't exist in the browser, so the SPA bundle
      // resolves them to small browser-safe shims. (No `node:fs` is ever pulled
      // in — we only use the package's pure `./lib`, never its fs `.` export.)
      // vitest runs under a node environment and is NOT aliased, so tests use
      // the real builtins.
      'node:crypto': fileURLToPath(
        new URL('./src/engine/providers/rich-markdown/shims/crypto.ts', import.meta.url),
      ),
      'node:path': fileURLToPath(
        new URL('./src/engine/providers/rich-markdown/shims/path.ts', import.meta.url),
      ),
    },
  },
})
