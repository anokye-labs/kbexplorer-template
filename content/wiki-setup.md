---
id: "wiki-setup"
title: "Setup Guide"
emoji: "Settings"
cluster: guide
derived: true
connections: []
---

Advanced setup options beyond [Getting Started](wiki-getting-started).

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_KB_LOCAL` | `true` | Enable [local loader](local-loader) mode |
| `VITE_KB_OWNER` | — | GitHub repo owner for remote mode |
| `VITE_KB_REPO` | — | GitHub repo name for remote mode |
| `GH_TOKEN` | — | GitHub token for manifest generation |

## Configuration Files

### config.yaml

Located in `content/config.yaml`, defines clusters, title, and subtitle. The [parser](parser) reads this at startup:

```yaml
title: "My Knowledge Base"
clusters:
  engine:
    name: "Engine"
    color: "#4A9CC8"
```

### nodemap.yaml

Defines how source files become graph nodes. See the [Node Mapping Spec](spec-node-mapping). The [node mapping](node-mapping) system processes five modes.

### staticwebapp.config.json

Configures Azure Static Web Apps SPA routing. The [application shell](app-shell) uses hash-based routing.

## Build Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start [Vite](vite-config) dev server |
| `npm run build` | Production build to `dist/` |
| `npm run prebuild` | Generate manifest via [build scripts](build-scripts) |
| `npm test` | Run [test suite](test-suite) |
| `npx playwright test` | Run E2E tests |

## Remote Mode

Set `VITE_KB_LOCAL=false` and provide owner/repo. The [GitHub API](github-api) fetches content with [cache](cache-system) support.
