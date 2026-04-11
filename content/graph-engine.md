---
id: "graph-engine"
title: "Graph Engine"
emoji: "Flash"
cluster: engine
connections: []
---


# Graph Engine

The graph engine (`src/engine/graph.ts`) receives a flat list of `KBNode[]` from the [content pipeline](content-pipeline) and transforms them into a computed `KBGraph` with edges, clusters, related nodes, and degree maps. All data shapes are imported from the [type system](type-system), and the engine is called by the [KB loader](kb-loader) and [local loader](local-loader) during startup.

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

Weight maps to vis-network spring length via the [graph network](graph-network) factory: `baseSpringLength / weight`. Higher weight = shorter spring = closer nodes.

## Hub Detection

`getHubNodeId()` prefers the `readme` node if it exists, otherwise falls to the highest-degree node. This ensures README is always the homepage. The [application shell](app-shell) calls this function to determine the initial route.

## Related Nodes

For each node, the engine computes up to 8 related nodes — its direct neighbors sorted by degree (most-connected first). These populate the [HUD](hud)'s connections panel, rendered via the [node renderer](node-renderer).
