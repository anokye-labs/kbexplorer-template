---
id: "wiki-infrastructure"
title: "Infrastructure & Conventions"
emoji: "Book"
cluster: guide
parent: "wiki-deep-dive"
connections:
  - to: "cache-system"
    description: "architecture doc"
  - to: "design-decisions"
    description: "architecture doc"
  - to: "build-scripts"
    description: "documents"
  - to: "manifest-generator"
    description: "documents"
  - to: "vite-config"
    description: "documents"
---



# Infrastructure & Conventions

## Deployment

Azure Static Web Apps via GitHub Actions. Push to `main` triggers build + deploy. PRs get staging previews. `staticwebapp.config.json` rewrites all paths to `index.html` for SPA routing.

## AGENTS.md Rules

Three hard rules codified for all agents working in this repo:

1. **No pixels** — use `vw`, `vh`, `%`, or Fluent tokens for all layout dimensions. Borders are the only exception.
2. **Bump `CACHE_VERSION`** — whenever cached data format changes, bump the constant in `src/api/github.ts`. Stale localStorage is the #1 source of "it's broken" reports.
3. **Verify with playwright** — test the actual user flow before declaring done. Test with persisted state, not clean browsers.

## Vite HMR Gotchas

After structural changes (new files, moved exports), HMR frequently serves stale code. The `$RefreshReg$ is not defined` error always means stale cache. Fix: kill server → delete `node_modules/.vite` → restart.

## Rate Limits

Unauthenticated GitHub API: 60 requests/hour. Every test browser session that clears localStorage triggers fresh API calls. Be conservative with cache-busting during development.
