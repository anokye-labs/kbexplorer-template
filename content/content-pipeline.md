---
id: content-pipeline
title: "Content Pipeline"
emoji: "Document"
cluster: data
connections:
  - to: graph-engine
    description: "produces nodes for"
  - to: github-api
    description: "fetches from"
  - to: overview
    description: "core module of"
  - to: file-src/engine/parser.ts
    description: "implemented in"
---

# Content Pipeline

The content pipeline (`src/engine/parser.ts`) converts raw GitHub API data into `KBNode[]` — the universal node format consumed by the graph engine.

## Repo-Aware Mode (Default)

When no content path is configured, kbexplorer treats the target repository itself as the knowledge base:

- **Issues** → one node per issue, clustered by first label. Icons assigned per type (Sparkle for feature, Wrench for task, Bug for bug). Cross-references (`#N`) become edges.
- **Issues with headings** → issues containing 2+ `##` headings are split into parent + section nodes, mirroring Okoto's document sectioning.
- **README** → single node with content-based connections. Scans for issue title keywords (60% match threshold), `#N` references, and directory name mentions.
- **File tree** → repo-root node, directory nodes (2 levels deep), and individual source files (`.ts`, `.tsx`, `.md`, `.json`, `.yaml`, `.css`). Files are parented to their containing directory.

PRs and commits were previously included but removed — the GitHub API doesn't provide reliable PR↔commit associations without per-PR API calls, which would exhaust the rate limit.

## Authored Mode

When `source.path` points to a directory of markdown files, each file's YAML frontmatter defines node metadata, connections, and cluster membership explicitly.

## UTF-8 Handling

GitHub's Contents API returns base64-encoded content. The pipeline decodes with `TextDecoder` (not `atob`) to correctly handle multi-byte UTF-8 characters like em dashes.
