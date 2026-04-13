import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
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
