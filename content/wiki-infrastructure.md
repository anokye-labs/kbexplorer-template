---
id: "wiki-infrastructure"
title: "Infrastructure Guide"
emoji: "Server"
cluster: guide
derived: true
connections: []
---

Build, test, and deployment infrastructure.

## Build System

[Vite 8](vite-config) for development and production. Custom plugin auto-generates manifest via [build scripts](build-scripts).

```bash
npm run dev        # Dev server (port 5173)
npm run build      # Production build to dist/
npm run prebuild   # Generate manifest
npm test           # Vitest unit tests
npx playwright test # E2E tests
```

## Testing

The [test suite](test-suite) has two layers: **Vitest** (unit tests for [parser](parser), [graph engine](graph-engine), [local loader](local-loader)) and **Playwright** (E2E verification). Always run Playwright before declaring done.

## Deployment

Azure Static Web Apps via GitHub Actions. Builds project, deploys `dist/`, creates PR staging environments. The [application shell](app-shell) uses hash routing for SPA compatibility.

## CI Lessons

- Pass `GH_TOKEN` to manifest generation (PR #74)
- Add `issues:read` and `pull-requests:read` permissions (PR #75)
- Wave-2 gates (#71): dependency review, linked issue validation, PR title validation

## Digital Twin Universe

The [GitHub API](github-api) mock server provides zero-dependency test doubles, eliminating rate limiting. See DTU.md.
