import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the **full-loop deployment scenario**.
 *
 * Tests the real deployment shape end-to-end:
 *   actor mutates twin
 *     → CLI regenerates manifest (KBEXPLORER_GH_API_BASE)
 *     → app serves in local mode from the freshly generated manifest
 *     → spec asserts the mutation is visible in the rendered graph
 *
 * ## Two substrates (toggled via FULL_LOOP_SUBSTRATE env var)
 *
 * | Substrate          | How to activate           | Status           |
 * |--------------------|---------------------------|------------------|
 * | static-twin        | default / FULL_LOOP_SUBSTRATE=static | ✅ passes in CI |
 * | gitea (live Podman)| FULL_LOOP_SUBSTRATE=gitea | 🔴 deferred (see below) |
 *
 * ### Deferred gap — live-Gitea half
 * Replacing the static-twin actor injection with a real Gitea actor requires:
 *   - Podman installed and a running machine (`npm run dtu:up && npm run dtu:seed`)
 *   - The Gitea adapter on DTU_TWIN_PORT (`npm run dtu:twin`)
 *   - KBEXPLORER_GH_API_BASE=http://localhost:<TWIN_PORT> pointing at the adapter
 *   - The globalSetup calling `openIssue()` from twins/gitea/actors/open-issue.mjs
 *
 * The spec assertions are substrate-agnostic and will pass unchanged once the
 * Gitea path is wired.
 *
 *   npm run test:e2e:full-loop
 */

const SUBSTRATE = process.env.FULL_LOOP_SUBSTRATE ?? 'static';
const APP_PORT = Number(process.env.FULL_LOOP_APP_PORT ?? 4318);

export default defineConfig({
  testDir: './e2e/full-loop',
  globalSetup: './e2e/full-loop/global-setup.mts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-full-loop' }]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [{ name: 'chromium', use: {} }],
  webServer: SUBSTRATE === 'gitea'
    ? [
        // ── Live-Gitea substrate (deferred — Podman required) ────────────────
        // globalSetup must have already run dtu:up + dtu:seed before this config
        // is evaluated. The adapter and app start here.
        {
          command: `node twins/gitea/server.mjs`,
          url: `http://localhost:${Number(process.env.DTU_TWIN_PORT ?? 3557)}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          env: { TWIN_PORT: process.env.DTU_TWIN_PORT ?? '3557' },
        },
        {
          command: `node ./node_modules/vite/bin/vite.js --port ${APP_PORT} --strictPort`,
          url: `http://localhost:${APP_PORT}`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          env: {
            VITE_KB_LOCAL: 'true',
            VITE_KB_SKIP_REGEN: '1',
          },
        },
      ]
    : [
        // ── Static-twin substrate (default) ──────────────────────────────────
        // The mutable twin used during globalSetup (FULL_LOOP_SETUP_PORT) is a
        // transient in-process server that stops after manifest generation.
        // The app is served in local mode from the pre-generated manifest; no
        // twin server is needed at test time.
        {
          command: `node ./node_modules/vite/bin/vite.js --port ${APP_PORT} --strictPort`,
          url: `http://localhost:${APP_PORT}`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          env: {
            VITE_KB_LOCAL: 'true',
            VITE_KB_SKIP_REGEN: '1',
          },
        },
      ],
});
