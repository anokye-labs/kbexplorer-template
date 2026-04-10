---
id: "spec-providers-overview"
title: "Graph Provider System — Overview"
emoji: "Organization"
cluster: design
connections:
  - to: "spec-node-mapping"
    description: "defines crawl phase"
  - to: "spec-graph-store"
    description: "defines walk phase"
  - to: "spec-views"
    description: "defines run phase"
  - to: "content-pipeline"
    description: "replaces monolithic loading in"
  - to: "graph-engine"
    description: "restructures how nodes feed into"
  - to: "kb-loader"
    description: "evolves loading strategy of"
  - to: "local-loader"
    description: "extends local mode in"
  - to: "manifest-generator"
    description: "replaces manifest approach in"
  - to: "type-system"
    description: "extends KBNode/KBGraph types defined in"
  - to: "issue-40"
    description: "tracked by"
---
---
# Graph Provider System — [kbexplorer Architecture](overview)

The graph provider system evolves kbexplorer's data pipeline from a monolithic
manifest into a layered, extensible architecture where **providers** contribute
nodes and edges to a unified graph with configurable depth.

## Design Principles

1. **Evolve, don't rewrite** — each step adds capability to the existing codebase
2. **File-first** — repos are made of files; the file/git providers come first
3. **Projection early** — defining how files map to nodes is the core problem
4. **Views as filters** — graph views are projections over provider subsets
5. **Append-only graph** — providers add to the graph, don't replace it
6. **Prescribed depth** — resolution limits are configurable, expansion is on-demand

## Current Architecture (What We Have)

```
config.yaml + content/*.md + GitHub API
         ↓
    parser.ts (monolithic)
    - loadAuthoredContent: 1 .md file → 1 node
    - loadRepoContent: issues, tree, README → nodes
    - splitIntoSections: 1 issue → N section nodes
    - auto-linking: fuzzy title matching for cross-references
         ↓
    graph.ts (buildGraph)
    - edges from connections + parent/child
    - orphan linking to hub
    - related node computation
         ↓
    KBGraph { nodes, edges, clusters, related }
         ↓
    Views (OverviewView, ReadingView, HUD)
```

### Existing Projection Patterns

The codebase already does file→node projection in several ways:

| Pattern | Where | What it Does |
|---------|-------|-------------|
| 1 .md → 1 node | `parseMarkdownFile` | Frontmatter defines id, cluster, connections |
| 1 issue → N nodes | `splitIntoSections` | Splits at `##` headings into parent + sections |
| N files → 1 node | `treeToNodes` | Groups files into directory nodes |
| content matching | `loadRepoContent` | Fuzzy title matching creates cross-reference edges |
| key file filter | `KEY_EXTENSIONS` set | Only `.ts`, `.tsx`, `.md`, `.json`, `.yaml`, `.css` surface as nodes |

### What's Missing

1. **No way to define custom projections** — "this .ts file should be a node displayed as a component diagram"
2. **No depth control** — everything resolves fully or not at all
3. **No expansion** — can't click to load more
4. **No graph filtering** — can't show "just files" or "just issues"
5. **No provider metadata** — `NodeSource` is a union type, not extensible

## Evolution Path

### Crawl: Node Mapping + Provider Metadata

**Goal**: Define how files become nodes. Add provider attribution to existing nodes.

See: `specs/providers/01-node-mapping.md`

### Walk: Graph Store + File/Git Providers

**Goal**: SQLite cache. Files and git as proper providers with depth limits.

See: `specs/providers/02-graph-store.md`

### Run: Views + On-Demand Expansion + External Providers

**Goal**: Graph views as projections. Click-to-expand. Plugin providers.

See: `specs/providers/03-views-and-expansion.md`

## Spec Tree

```
specs/
├── providers/
│   ├── 00-overview.md              ← this file
│   ├── 01-node-mapping.md          ← how files become nodes (projections)
│   ├── 02-graph-store.md           ← SQLite cache + provider interface
│   └── 03-views-and-expansion.md   ← graph views + on-demand + external
```
