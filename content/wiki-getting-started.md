---
id: "wiki-getting-started"
title: "Getting Started"
emoji: "Rocket"
cluster: guide
derived: true
connections: []
---

This guide walks you through setting up kbexplorer for local development.

## Prerequisites

- **Node.js 18+** and npm
- **Git** for cloning
- Optional: `gh` CLI for fetching GitHub data into the manifest

## Step 1: Clone and Install

```bash
git clone https://github.com/anokye-labs/kbexplorer-template.git
cd kbexplorer-template
npm install
```

## Step 2: Generate the Manifest

The [build scripts](build-scripts) create a local manifest:

```bash
npm run prebuild
```

This runs the [manifest generator](manifest-generator) which walks the file system and optionally calls `gh` for issue data. Output goes to `src/generated/repo-manifest.json`.

## Step 3: Start Development

```bash
npm run dev
```

Vite starts on `http://localhost:5173`. The [Vite configuration](vite-config) auto-regenerates the manifest on build start.

## Step 4: Explore

- Open the browser — land on the [overview grid](overview-view)
- Click a card to enter the [reading view](reading-view)
- Press `t` to try different [themes](theme-system)
- Open the [HUD](hud) minimap to see the full constellation

## Troubleshooting

- **`$RefreshReg$ is not defined`** — Vite HMR stale cache. Kill Vite, delete `node_modules/.vite`, restart
- **Empty graph** — run `npm run prebuild` to regenerate
- **Rate limited** — the [local loader](local-loader) bypasses the [GitHub API](github-api) entirely

## Next Steps

- **[Setup Guide](wiki-setup)** — detailed configuration
- **[Configuration Guide](wiki-configuration)** — clusters, themes, caching
- **[Content Modes](wiki-content-modes)** — authored vs repo-aware
- **[Data Pipeline Guide](wiki-data-pipeline)** — how content flows
- **[HUD System Guide](wiki-hud-system)** — master the sidebar
- **[Infrastructure Guide](wiki-infrastructure)** — CI/CD and deployment
