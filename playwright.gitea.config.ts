import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the **Gitea Digital Twin Universe** scenario suite.
 *
 * Separate from the default `playwright.config.ts` (static fixture twin) so the
 * fast e2e gate stays untouched and dependency-free. This config drives the REAL
 * app (dev server) against the stateful GitHub→Gitea translation adapter backed
 * by a live Podman Gitea, validating the full multi-agent loop:
 *   actor mutates Gitea  →  app refresh  →  graph reflects the change.
 *
 * Distinct ports (APP_PORT / DTU_TWIN_PORT) let this suite coexist with the
 * default twin suite and other worktrees running on 4173/3456.
 *
 *   npm run test:e2e:gitea
 */
const APP_PORT = Number(process.env.DTU_APP_PORT ?? 4319);
const TWIN_PORT = Number(process.env.DTU_TWIN_PORT ?? 3557);
const OWNER = process.env.KB_OWNER ?? 'anokye-labs';
const REPO = process.env.KB_REPO ?? 'kbexplorer-template';
const BRANCH = process.env.KB_BRANCH ?? 'main';

export default defineConfig({
  testDir: './e2e/gitea',
  globalSetup: './twins/gitea/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90000,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-gitea' }]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [{ name: 'chromium', use: {} }],
  webServer: [
    {
      // Stateful GitHub→Gitea adapter on a dedicated port.
      command: 'node twins/gitea/server.mjs',
      url: `http://localhost:${TWIN_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: { TWIN_PORT: String(TWIN_PORT) },
    },
    {
      // Real app (dev server) in remote/repo-aware mode, pointed at the adapter.
      //
      // `ensure-manifest-stub.mjs` writes a minimal stub
      // src/generated/repo-manifest.json (only if absent) so Vite's
      // import-analysis can resolve the static import of it in
      // src/engine/local-loader.ts. A bare `vite` dev server never runs
      // `prebuild`, so in a fresh CI checkout that gitignored file is missing and
      // the server 500s on import resolution — the app never boots and every
      // gitea spec fails. Chaining the stub ahead of `vite` (rather than writing
      // it in globalSetup, which Playwright starts concurrently with the
      // webServers) is race-free: the file exists before Vite's first transform.
      // The stub does NOT run generate-manifest.js and makes NO GitHub/`gh`
      // calls; the app runs in REMOTE mode (no VITE_KB_LOCAL) and never reads the
      // manifest at runtime — it exists solely to satisfy the resolver.
      command: `node twins/gitea/ensure-manifest-stub.mjs && node ./node_modules/vite/bin/vite.js --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        VITE_GH_API_BASE: `http://localhost:${TWIN_PORT}`,
        VITE_KB_OWNER: OWNER,
        VITE_KB_REPO: REPO,
        VITE_KB_BRANCH: BRANCH,
      },
    },
  ],
});
