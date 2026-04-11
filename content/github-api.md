---
id: "github-api"
title: "GitHub API Client"
emoji: "PlugConnected"
cluster: data
connections: []
---


# GitHub API Client

The API client (`src/api/github.ts`) handles all communication with GitHub's REST API, supplying raw data to the [content pipeline](content-pipeline). It uses `SourceConfig` from the [type system](type-system) for endpoint configuration, and its type definitions are also imported by the [local loader](local-loader). The module also exports `resolveImageUrl`, used by the [visual system](visual-system) to resolve repository-relative image paths.

## Endpoints Used

- `GET /repos/{owner}/{repo}/issues?state=all` — all issues (PRs filtered out client-side)
- `GET /repos/{owner}/{repo}/contents/{path}` — single file content (base64 encoded)
- `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` — full file tree

## Caching

All responses are cached via the [cache system](cache-system) in `localStorage` with a 5-minute TTL under the `kbe:` prefix. A `CACHE_VERSION` constant in the module header auto-invalidates all cached data when bumped — this prevents stale data from poisoning renders after breaking changes to the parsing logic.

## Rate Limit Handling

Unauthenticated GitHub API allows 60 requests/hour. When exhausted (403 + `X-RateLimit-Remaining: 0`), the client throws `RateLimitError`. The loading hook catches this and shows an error screen instead of a blank page.

## Error Recovery

Each fetch in `loadRepoContent` is wrapped in `.catch(() => [])` so partial failures (e.g., rate limit on issues but not tree) still produce a usable graph. If ALL content is empty (0 nodes), the app shows an explicit error screen.
