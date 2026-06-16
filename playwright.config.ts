import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Opt-in suites with external dependencies are excluded from this fast,
  // dependency-free e2e gate and run only via their dedicated configs:
  //  - e2e/gitea/**     — live Podman Gitea + .dtu/state.json (playwright.gitea.config.ts)
  //  - e2e/full-loop/** — its globalSetup writes .dtu/full-loop-state.json and
  //                       needs the kbexplorer-cli sibling (playwright.full-loop.config.ts)
  testIgnore: ['**/e2e/gitea/**', '**/e2e/full-loop/**'],
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
