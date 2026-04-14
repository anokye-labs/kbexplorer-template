---
id: "vite-config"
title: "Vite Configuration"
emoji: "Settings"
cluster: infra
derived: true
connections: []
---

The Vite configuration (`vite.config.ts`) defines the build and development setup for kbexplorer. Vite 8 was chosen for its fast HMR, ESM-native architecture, and TypeScript support. The configuration handles manifest auto-generation, path resolution, and build optimization.

## Manifest Plugin

A custom Vite plugin runs `generate-manifest.js` from the [build scripts](build-scripts) on `buildStart`. This ensures the manifest is always fresh when starting dev or building for production — implemented in [#35](https://github.com/anokye-labs/kbexplorer-template/issues/35).

```typescript
export default defineConfig({
  plugins: [
    react(),
    manifestPlugin(), // runs generate-manifest.js on buildStart
  ],
});
```

## HMR Caveats

After structural changes (new files, moved exports, changed module boundaries), HMR frequently serves stale code. The AGENTS.md documents the workaround: kill Vite, delete `node_modules/.vite`, restart. The `$RefreshReg$ is not defined` error always means stale cache.

## Build Output

Production builds output to `dist/` for deployment to Azure Static Web Apps. The `staticwebapp.config.json` configures SPA fallback routing so hash-based routes work. Vite was updated to 8.0.5 in [PR #68](https://github.com/anokye-labs/kbexplorer-template/pull/68) to clear security advisories.

## Integration

The Vite config is shared with the [test suite](test-suite) (vitest extends it) and works with the [build scripts](build-scripts) for manifest generation.
