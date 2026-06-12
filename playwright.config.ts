import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The Gitea Digital Twin Universe specs live under e2e/gitea but require a live
  // Podman-backed Gitea + bootstrapped .dtu/state.json. They run only via their
  // dedicated playwright.gitea.config.ts (npm run test:e2e:gitea / nightly DTU
  // workflow), so exclude them from this fast, dependency-free e2e gate.
  testIgnore: '**/e2e/gitea/**',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'edge',
      use: { channel: 'msedge' },
    },
    {
      name: 'chromium',
      use: {},
    },
  ],
  webServer: [
    {
      command: 'npx vite preview --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'node twins/github/server.js',
      url: 'http://localhost:3456/health',
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
  ],
});
