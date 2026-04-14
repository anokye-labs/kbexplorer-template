---
id: "github-api"
title: "GitHub API & Cache"
emoji: "Cloud"
cluster: data
derived: true
connections: []
---

The GitHub API client (`src/api/github.ts`) fetches repository content at runtime — file trees, issues, pull requests, README, and individual files. It includes a built-in [cache system](cache-system) that stores responses in localStorage with TTL-based expiration, and a version-stamped cache that invalidates automatically when the data shape changes.

## API Functions

```typescript
fetchTree(source: SourceConfig): Promise<GHTreeItem[]>
fetchFile(source: SourceConfig, path: string): Promise<string>
fetchFiles(source: SourceConfig, paths: string[]): Promise<Record<string, string>>
fetchIssues(source: SourceConfig): Promise<GHIssue[]>
resolveImageUrl(source: SourceConfig, path: string): string
```

Each function constructs a GitHub REST API URL, checks the cache, and falls back to a network fetch. The `resolveImageUrl` function was updated for local mode in [#34](https://github.com/anokye-labs/kbexplorer-template/issues/34) — in local mode it returns `import.meta.env.BASE_URL + path` instead of `raw.githubusercontent.com`.

## Rate Limiting

GitHub's REST API has a 60 req/hour limit for unauthenticated requests. The [local loader](local-loader) eliminates this entirely by using pre-built manifests. The [Digital Twin Universe (PR #66)](https://github.com/anokye-labs/kbexplorer-template/pull/66) provides a mock server for development and testing, bypassing both rate limits and network flakiness.

## CI Integration

Missing `GH_TOKEN` in CI was a recurring pain point. [PR #74](https://github.com/anokye-labs/kbexplorer-template/pull/74) fixed the deploy build's manifest generation, and [PR #75](https://github.com/anokye-labs/kbexplorer-template/pull/75) added `issues:read` and `pull-requests:read` permissions to the workflow. The wave 1 readiness work ([#69](https://github.com/anokye-labs/kbexplorer-template/issues/69)) hardened the overall CI configuration. The GitHub Pages base path was fixed in commit `e263f95`.

## Integration

The API client is consumed by the [parser](parser) for remote-mode content loading, by the [files provider](files-provider) indirectly through `treeToNodes()`, and by the [work provider](work-provider) for issue/PR fetching. The [type system](type-system) defines the `SourceConfig` interface that all API functions accept. The [content pipeline](content-pipeline) routes through this module in remote mode.
