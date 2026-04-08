---
id: cache-system
title: "Cache & Versioning"
emoji: "Wrench"
cluster: infra
connections:
  - to: github-api
    description: "caches responses for"
  - to: content-pipeline
    description: "invalidates when pipeline changes"
---

# Cache & Versioning

The caching system prevents redundant GitHub API calls and protects against stale data after code changes.

## How It Works

All API responses are stored in `localStorage` under the `kbe:` prefix with a 5-minute TTL. On each fetch, the client checks for a cached entry — if present and fresh, it's returned without hitting the network.

## Version Invalidation

A `CACHE_VERSION` constant at the top of `src/api/github.ts` acts as a schema version for cached data. On app load, the stored version is compared to the current constant. If they differ, **all** `kbe:` prefixed localStorage keys are cleared.

This is critical because changes to the parsing logic (e.g., adding file nodes, fixing UTF-8 encoding, changing connection algorithms) produce incompatible cached data. Without versioning, users see broken renders that only clear with manual "Clear site data."

### Rule

**Bump `CACHE_VERSION` whenever you change:**
- The shape or encoding of cached data
- localStorage key names or value formats
- Content parsing logic that changes what nodes/edges are produced
- Any setting stored in localStorage

This rule is codified in `AGENTS.md`.

## Settings Persistence

User preferences are stored separately from API cache:
- `kbe-hud-dock` — dock position
- `kbe-hud-collapsed` — collapsed state
- `kbe-sidebar-w` — sidebar width (vw)
- `kbe-map-split` — graph/connections split (%)
- `kbe-font-size` — font size index
- `kbe-col-width` — column width index
- `kbe-theme` — theme preference
