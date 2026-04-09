---
id: "wiki-data-pipeline"
title: "Data Pipeline"
emoji: "Book"
cluster: guide
parent: "wiki-deep-dive"
connections:
  - to: "content-pipeline"
    description: "architecture doc"
  - to: "github-api"
    description: "architecture doc"
  - to: "graph-engine"
    description: "architecture doc"
  - to: "local-loader"
    description: "documents"
---



# Data Pipeline

The data pipeline transforms raw GitHub API responses into an interactive knowledge graph.

## Flow

1. **`useKnowledgeBase`** hook triggers on mount
2. **GitHub API client** (`src/api/github.ts`) fetches issues, file tree, README — with localStorage caching and rate limit handling
3. **Content parser** (`src/engine/parser.ts`) normalizes into `KBNode[]` — assigns icons, clusters, cross-references, parent/child relationships
4. **Graph engine** (`src/engine/graph.ts`) computes edges (explicit connections + containment), rescues orphans, builds related-node maps
5. **Views** render the computed `KBGraph`

## Blended Loading

When `source.path` is configured, the hook loads both repo-aware content AND authored markdown files, merging them before graph computation. This creates a unified graph where documentation nodes link to code nodes.

## Key Implementation Details

- UTF-8 decoding uses `TextDecoder` (not `atob`) for multi-byte character safety
- Issue cross-references (`#N`) become edges automatically
- README connections use 60% keyword match threshold against issue titles
- Files with key extensions (`.ts`, `.tsx`, `.md`, `.json`, `.yaml`, `.css`) become individual nodes parented to their directory
- `CACHE_VERSION` constant auto-invalidates stale cached data on code changes
