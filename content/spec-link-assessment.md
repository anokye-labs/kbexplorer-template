---
id: "spec-link-assessment"
title: "Link Assessment — Graph Health Analysis"
emoji: "Search"
cluster: design
connections:
  - to: "spec-providers-overview"
    description: "quality assurance for"
  - to: "spec-node-mapping"
    description: "validates mappings produced by"
  - to: "graph-engine"
    description: "analyzes output of"

  - to: "manifest-generator"
    description: "reads manifest produced by"

  - to: "spec-multi-layer-identity"
    description: "helps identify where identity mapping is needed by"

---

# Link Assessment — Graph Health Analysis

## Problem

As the graph grows across providers and content, connection quality degrades
silently. Authored content nodes may reference nodes that don't exist. Source
files mentioned in documentation may not have corresponding edges. Entire
clusters may be internally connected but isolated from the rest of the graph.

There is no tool to detect these problems. You only discover them by browsing
the graph and noticing something looks wrong.

## Solution: `npx @anokye-labs/kbexplorer links`

A CLI command that analyzes the graph and reports health issues:

### Analysis Categories

| Category | What It Detects |
|----------|----------------|
| **Orphan nodes** | Nodes with zero connections — they float alone in the graph |
| **Broken references** | Connections where `to:` points to a node ID that doesn't exist |
| **Weak clusters** | Clusters where nodes only connect within the cluster — no cross-cluster edges |
| **Missing cross-references** | Content that mentions file paths, node titles, or issue numbers in its body text but has no corresponding connection in frontmatter |
| **Coverage gaps** | Source files in the repo that have no corresponding content node |
| **Stale connections** | Connections to nodes from providers that haven't run recently |

### Output

```
$ npx @anokye-labs/kbexplorer links

Graph Health Report
───────────────────
Nodes: 41 authored, 26 issues, 19 PRs, 50 commits, 103 files
Edges: 219 total

⚠ Orphan nodes (3):
  - file-eslint.config.js (no connections)
  - issue-14 (no connections to other nodes)
  - pr-15 (no connections)

✗ Broken references (1):
  - [Views, Expansion, and External Providers](spec-views) → [issue 46](issue-46) (node does not exist)

⚠ Weak clusters (1):
  - "guide" cluster: 11 nodes, 0 cross-cluster edges

⚠ Missing cross-references (5):
  - [Content Pipeline](content-pipeline).md mentions "github.ts" but no connection to github-api
  - spec-graph-store.md mentions "SQLite" but no connection to cache-system
  ...

⚠ Coverage gaps (8):
  - src/index.css — no content node
  - src/styles/responsive.css — no content node
  ...

Suggestions:
  - Add connection from content-pipeline → github-api
  - Consider authored content for src/index.css
```

### Interactive Mode

With `--fix` flag, the tool offers to:
- Add missing cross-reference connections to frontmatter
- Create skeleton content nodes for uncovered source files
- Remove broken references

### How It Works

The assessment reads from the manifest (or graph store when that exists).
It builds the full node + edge graph, then runs each analysis pass:

1. **Orphan detection**: nodes with degree 0 in the adjacency list
2. **Broken reference scan**: connections where `to` ID isn't in the node map
3. **Cluster isolation**: for each cluster, count edges that cross cluster boundaries
4. **Content scanning**: regex scan of `rawContent` for file paths (`src/...`), node IDs, and issue refs (`#N`), then check if corresponding edges exist
5. **Coverage check**: compare file tree nodes against content nodes

### Relationship to Providers

When the provider system (spec-graph-store) is implemented, the link assessment
runs against the unified graph store instead of the manifest. Each analysis
category maps to a provider:
- Broken references → cross-provider edge validation
- Coverage gaps → files provider vs authored provider comparison
- Stale connections → provider_state.last_run timestamps
