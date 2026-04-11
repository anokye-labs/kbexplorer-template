---
id: "wiki-infrastructure"
title: "Infrastructure & Conventions"
emoji: "Book"
cluster: guide
parent: "wiki-deep-dive"
connections: []
---



# Infrastructure & Conventions

## Deployment

Azure Static Web Apps via GitHub Actions, with build tooling from the [Vite configuration](vite-config). The [build scripts](build-scripts) and [manifest generator](manifest-generator) automate pre- and post-build steps. Push to `main` triggers build + deploy. PRs get staging previews. `staticwebapp.config.json` rewrites all paths to `index.html` for SPA routing.

## AGENTS.md Rules

Three hard rules codified for all agents working in this repo (see [design decisions](design-decisions) for rationale):

1. **No pixels** — use `vw`, `vh`, `%`, or Fluent tokens for all layout dimensions. Borders are the only exception.
2. **Bump `CACHE_VERSION`** — whenever cached data format changes, bump the constant in `src/api/github.ts` (see [cache system](cache-system) for details). Stale localStorage is the #1 source of "it's broken" reports.
3. **Verify with playwright** — test the actual user flow before declaring done. Test with persisted state, not clean browsers.

## Vite HMR Gotchas

After structural changes (new files, moved exports), HMR frequently serves stale code. The `$RefreshReg$ is not defined` error always means stale cache. Fix: kill server → delete `node_modules/.vite` → restart.

## Rate Limits

Unauthenticated GitHub API: 60 requests/hour. Every test browser session that clears localStorage triggers fresh API calls. Be conservative with cache-busting during development.
