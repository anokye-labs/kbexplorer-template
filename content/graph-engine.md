---
id: "graph-engine"
title: "Graph Engine"
emoji: "⚡"
cluster: engine
connections:
  - to: "content-pipeline"
    description: "receives nodes from"
  - to: "node-renderer"
    description: "renders via"
  - to: "hud"
    description: "displayed in"
  - to: "graph-network"
    description: "factory delegates to"
  - to: "kb-loader"
    description: "called by"
  - to: "local-loader"
    description: "called by"
  - to: "type-system"
    description: "imports types from"
  - to: "app-shell"
    description: "getHubNodeId used by"
---


# Graph Engine

The graph engine (`src/engine/graph.ts`) transforms a flat list of `KBNode[]` into a computed `KBGraph` with edges, clusters, related nodes, and degree maps.

## Edge Construction

Edges come from three sources:

1. **Explicit connections** — declared in node frontmatter or parsed from `#N` cross-references in issue bodies
2. **Parent → child containment** — any node with a `parent` field gets a weighted edge (weight 3) to its parent, pulling them close together in the force layout
3. **Orphan rescue** — nodes with zero edges are auto-connected to a same-cluster sibling or the graph hub, preventing unreachable dead-ends

## Weighted Edges

Each edge carries a `weight` field:
- **3** — containment (folder → subfolder, parent → section)
- **1** — normal reference
- **0.5** — orphan rescue (weak link)

Weight maps to vis-network spring length: `baseSpringLength / weight`. Higher weight = shorter spring = closer nodes.

## Hub Detection

`getHubNodeId()` prefers the `readme` node if it exists, otherwise falls to the highest-degree node. This ensures README is always the homepage.

## Related Nodes

For each node, the engine computes up to 8 related nodes — its direct neighbors sorted by degree (most-connected first). These populate the HUD's connections panel.
