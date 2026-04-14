---
id: "kb-loader"
title: "KB Loader Hook"
emoji: "ArrowDownload"
cluster: ui
derived: true
connections: []
---

The KB loader hook (`src/hooks/useKnowledgeBase.ts`) is the React hook that bootstraps the entire knowledge graph on app startup. It detects the content mode, fetches or loads data, and returns a discriminated union that the [application shell](app-shell) uses to render loading, error, or ready states.

## Mode Detection

The hook first calls `detectLocalMode()` from the [local loader](local-loader). If local mode is active (manifest exists), the entire graph loads from the pre-built manifest with zero API calls. Otherwise, it falls through to remote mode using the [GitHub API](github-api).

```typescript
export function useKnowledgeBase(sourceOverride?: SourceConfig): LoadingState {
  // 1. detectLocalMode() — check for manifest
  // 2. If local: loadLocalKnowledgeBase() — zero API calls
  // 3. If remote: loadConfig → loadRepoContent → loadAuthoredContent
  // 4. extractClusters → buildGraph → { graph, config }
}
```

## Loading Pipeline (Remote Mode)

1. `loadConfig()` — fetch `config.yaml` from the repo
2. `loadRepoContent()` — fetch issues, tree, README via [GitHub API](github-api)
3. `loadAuthoredContent()` — fetch markdown from content directory (optional)
4. `extractClusters()` — derive clusters from all nodes via the [parser](parser)
5. `buildGraph()` — compute edges and related nodes via the [graph engine](graph-engine)

## Error Handling

The hook catches all errors and maps them to user-friendly messages. Empty node arrays get specific messaging. The [loading screen](loading-error-screens) renders these messages.

## Cancellation

The `useEffect` cleanup sets a `cancelled` flag, preventing state updates after unmount — avoiding React's "can't update unmounted component" warning during fast navigation. The [type system](type-system) and [cache system](cache-system) provide the underlying data structures.
