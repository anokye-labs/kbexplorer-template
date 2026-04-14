---
id: "test-suite"
title: "Test Suite"
emoji: "Beaker"
cluster: infra
derived: true
connections: []
---

The test suite (`vitest.config.ts` and `e2e/`) provides two testing layers: unit tests via Vitest and end-to-end tests via Playwright. Together they ensure the [content pipeline](content-pipeline), [graph engine](graph-engine), and UI views work correctly.

## Unit Tests (Vitest)

Vitest shares configuration with the [Vite config](vite-config), so path aliases and TypeScript settings are consistent. Unit tests cover:

- [Parser](parser) — frontmatter extraction, inline link parsing, issue-to-node conversion
- [Graph engine](graph-engine) — edge construction, hub detection, related node ranking
- [Local loader](local-loader) — manifest loading, mode detection, glob resolution
- [Build scripts](build-scripts) — manifest generation, tree walking

The test coverage initiative ([#37](https://github.com/anokye-labs/kbexplorer-template/issues/37)) established the baseline for the local data pipeline.

## End-to-End Tests (Playwright)

Playwright tests in `e2e/` verify the full user experience: page loads, view navigation, theme cycling, graph rendering, content display. The AGENTS.md rule requires Playwright verification before declaring any feature done. Playwright caught the missing GH_TOKEN issue ([PR #74](https://github.com/anokye-labs/kbexplorer-template/pull/74)) and empty work view bug.

```typescript
// playwright.config.ts
export default defineConfig({
  webServer: { command: 'npm run dev', port: 5173 },
  use: { baseURL: 'http://localhost:5173' },
});
```

## Integration

The [build scripts](build-scripts) are tested via Vitest. The [Vite configuration](vite-config) provides shared settings. CI workflows run both test layers on every PR.
