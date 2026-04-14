---
id: "cache-system"
title: "Cache System"
emoji: "Database"
cluster: data
derived: true
connections: []
---

The cache system (embedded in `src/api/github.ts`) reduces GitHub API calls by storing responses in `localStorage` with TTL-based expiration. It is tightly integrated with the [GitHub API client](github-api) because cache key formats depend on API URL patterns.

## How It Works

Each cached entry is stored as a JSON object with a timestamp and data payload under a `kbe:` prefixed key. On read, the system checks whether the entry is within its 5-minute TTL window. Expired or missing entries trigger a fresh network fetch.

```typescript
const CACHE_PREFIX = 'kbe:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 12;
```

## Version Stamping

`CACHE_VERSION` is the most critical value in this system. When bumped, all previously cached data is purged on next load. The AGENTS.md contains a strict rule: **bump `CACHE_VERSION` whenever you change the shape or encoding of cached data, localStorage key formats, content parsing logic, or any `kbe-*` setting**. Failing to do this causes silent corruption — users see stale data that doesn't match the current parser expectations, leading to broken renders that only clear with manual "Clear site data."

## What Gets Cached

- File tree responses (consumed by the [files provider](files-provider))
- Individual file contents (consumed by the [parser](parser))
- Issue lists (consumed by the [work provider](work-provider))
- README content

## Why Not IndexedDB

localStorage was chosen for simplicity and synchronous access. The 5MB limit is sufficient because kbexplorer caches JSON responses, not binary blobs. The [Digital Twin Universe (PR #66)](https://github.com/anokye-labs/kbexplorer-template/pull/66) bypasses the cache entirely for testing.

## Integration

The cache is consumed by the [GitHub API](github-api) functions. The [KB loader](kb-loader) triggers cache reads during startup. The [local loader](local-loader) bypasses the cache entirely since it reads from the pre-built manifest. Settings stored in localStorage (like `kbe-theme` from the [theme system](theme-system)) use different key prefixes and are not affected by version bumps. The [type system](type-system) defines the data shapes that the cache stores.
