import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.js',
      'twins/**/__tests__/**/*.test.{js,mjs,ts}',
      'tests/golden/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/fluentui-system-icons/**', '**/dist/**'],
    testTimeout: 10000,
  },
});
