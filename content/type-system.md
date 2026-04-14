---
id: "type-system"
title: "Type System"
emoji: "Code"
cluster: engine
derived: true
connections: []
---

The type system (`src/types/index.ts`) is the shared vocabulary of kbexplorer. Every module imports its data shapes from here — node definitions, edge semantics, cluster membership, configuration schema. Changing a type here ripples through the [graph engine](graph-engine), the [parser](parser), the [identity system](identity), and all three views.

## Core Types

```typescript
interface KBNode {
  id: string;
  title: string;
  content: string;           // rendered HTML
  rawContent?: string;       // original markdown
  emoji?: string;            // Fluent icon name
  cluster?: string;          // cluster membership
  connections: Connection[];  // edges to other nodes
  parent?: string;           // containment parent
  source: NodeSource;        // provenance (authored, file, issue, …)
  identity?: string;         // canonical URN
  provider?: string;         // which provider produced it
}

interface KBEdge {
  from: string;
  to: string;
  type: EdgeType;
  weight: number;
  description?: string;
  source: string;            // frontmatter | inline | inferred
}
```

## Edge Types and Weights

The typed edge system was designed in the [typed edges spec](typed-edges) and implemented in [#50](https://github.com/anokye-labs/kbexplorer-template/issues/50). `EDGE_TYPE_WEIGHTS` maps each type to a numeric weight; `EDGE_TYPE_STYLES` maps to visual properties consumed by the [graph network](graph-network) factory:

| Type | Weight | Visual | Meaning |
|------|--------|--------|---------|
| `contains` | 3 | solid, thick | Parent-child |
| `references` | 1 | solid, thin | Explicit link |
| `cross_references` | 0.8 | dashed | Issue cross-reference |
| `related` | 0.5 | dotted, faint | Orphan rescue |

The ranking redesign ([#52](https://github.com/anokye-labs/kbexplorer-template/issues/52)) ensured edge type weights affect the [HUD](hud)'s related panel ordering.

## Configuration

`KBConfig` defines the runtime configuration shape, and `DEFAULT_CONFIG` provides fallback values. `SourceConfig` specifies where to fetch content — repo owner/name, content path, and display mode. The [KB loader](kb-loader) and [local loader](local-loader) both read config at startup.

## Display Modes

The `DisplayMode` union (`'authored' | 'repo-aware'`) determines which content pipeline runs. Authored mode loads markdown from a content directory; repo-aware mode fetches from the [GitHub API](github-api). The [overview](overview) summarizes both modes.

## Cluster Types

`Cluster` carries `id`, `name`, `color`, and optional `description`. The [parser](parser)'s `extractClusters()` generates these from node metadata, and the [graph engine](graph-engine) groups nodes visually by cluster. [PR #5](https://github.com/anokye-labs/kbexplorer-template/pull/5) introduced the [overview view](overview-view) card grid that groups nodes by cluster.

## Node Map Types

`NodeMapEntry` and `NodeMap` define the schema for `nodemap.yaml` entries processed by the [node mapping](node-mapping) system — including file/glob/directory modes and connection derivation strategies.
