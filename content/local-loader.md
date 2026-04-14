---
id: "local-loader"
title: "Local Loader"
emoji: "FolderOpen"
cluster: engine
derived: true
connections: []
---

The local loader (`src/engine/local-loader.ts`) enables kbexplorer to run entirely offline by reading from a pre-built manifest instead of calling the [GitHub API](github-api) at runtime. This eliminates rate limiting, reduces startup latency, and makes the app work in CI environments — it was the central feature of the local mode initiative ([#29–#37](https://github.com/anokye-labs/kbexplorer-template/issues/32), delivered in [PR #38](https://github.com/anokye-labs/kbexplorer-template/pull/38)).

## Mode Detection

`isLocalMode()` checks the `VITE_KB_LOCAL` environment variable. `detectLocalMode()` is the async wrapper for hook compatibility. The [KB loader hook](kb-loader) calls `detectLocalMode()` first and branches accordingly — local mode means zero network calls.

```typescript
export function isLocalMode(): boolean {
  return import.meta.env.VITE_KB_LOCAL === 'true';
}
```

## The Manifest

The [build scripts](build-scripts) generate `src/generated/repo-manifest.json` at build time. This `RepoManifest` interface captures everything the API would have returned: `configRaw`, `authoredContent` (path→markdown map), `tree` (GHTreeItem array), `readme`, `issues`, `pullRequests`, `commits`, plus `nodemapRaw` and `nodemapFiles` for the [node mapping](node-mapping) system. The manifest script ([#30](https://github.com/anokye-labs/kbexplorer-template/issues/30)) walks the file system and calls `gh` CLI for GitHub data.

## Loading Pipeline

`loadLocalKnowledgeBase()` is the main entry point. It lazy-loads the manifest (cached in a module-level promise), builds a [provider registry](providers-overview) with [authored](authored-provider), [files](files-provider), and [work](work-provider) providers, then calls the [orchestrator](orchestrator) to run them in dependency order. The result is a `{ graph, config }` pair identical to what the remote path produces.

The loader imports `parseMarkdownFile`, `issueToNode`, `treeToNodes`, `extractClusters`, `buildGraph`, and `splitIntoSections` from the [parser](parser) and [graph engine](graph-engine) — the same functions used in remote mode, ensuring data consistency.

## Glob Resolution

The loader includes a `globToRegex()` helper that converts simple glob patterns (like `src/engine/*.ts`) to regular expressions for matching against the manifest file tree. This supports the [node mapping](node-mapping) glob mode without requiring filesystem access at runtime.

## Identity

All nodes loaded from the manifest receive [identity](identity) URNs via `assignIdentity()`. Authored content gets `urn:content:`, files get `urn:file:`, issues get `urn:issue:`. The [multi-layer identity](multi-layer-identity) system ties these together across providers.

## Testing

The local data pipeline has comprehensive Vitest coverage ([#37](https://github.com/anokye-labs/kbexplorer-template/issues/37)) including manifest generation, content parsing, and mode routing via the [test suite](test-suite).
