---
id: "manifest-generator"
title: "Manifest Generator"
emoji: "BuildingFactory"
cluster: infra
derived: true
connections: []
---

The manifest generator (`scripts/generate-manifest.js`) is the pre-build script that creates the complete data snapshot used by the [local loader](local-loader). It replaces all runtime [GitHub API](github-api) calls with a single static JSON file.

## What It Generates

`src/generated/repo-manifest.json` contains:

1. **File tree** — GHTreeItem-compatible array from local file system walk
2. **Content files** — all markdown from `content/` directory, embedded as strings
3. **Issues** — fetched via `gh issue list` CLI command
4. **Pull requests** — fetched via `gh pr list` CLI command
5. **Commits** — fetched via `gh api` for recent history
6. **Config** — `config.yaml` and `nodemap.yaml` contents

## Vite Integration

The [Vite configuration](vite-config) includes a plugin that runs the manifest generator on `buildStart` ([#35](https://github.com/anokye-labs/kbexplorer-template/issues/35)). This ensures freshness for both development and production builds.

```bash
npm run prebuild   # or: node scripts/generate-manifest.js
```

## CI Lessons

Missing `GH_TOKEN` in CI silently produces empty work data. [PR #74](https://github.com/anokye-labs/kbexplorer-template/pull/74) fixed the deploy build, and [PR #75](https://github.com/anokye-labs/kbexplorer-template/pull/75) added required permissions. These failures were caught by Playwright E2E tests in the [test suite](test-suite).

## Integration

The generator is called by the [build scripts](build-scripts) and feeds the [local loader](local-loader). The [authored provider](authored-provider), [files provider](files-provider), and [work provider](work-provider) all consume manifest data.
