---
id: "graph-engine"
title: "Graph Engine"
emoji: "Flash"
cluster: engine
derived: true
connections: []
---

The graph engine (`src/engine/graph.ts`) receives a flat list of `KBNode[]` from the [content pipeline](content-pipeline) and transforms them into a computed `KBGraph` with edges, clusters, related nodes, and degree maps. All data shapes are imported from the [type system](type-system), and the engine is called by the [orchestrator](orchestrator) during startup. Without this module, nodes would float as disconnected islands and the constellation view would be meaningless.

## Edge Construction

`buildEdges()` iterates every node's `connections` array plus `parent` field, producing deduplicated `KBEdge` objects. Deduplication uses a canonical key (`edgeKey(a,b)` sorts IDs lexicographically) so `A→B` and `B→A` collapse to one edge. Edges come from three sources, each assigned a semantic type defined in the [typed edges spec](typed-edges):

1. **Explicit connections** — declared in node frontmatter or parsed from `#N` cross-references in issue bodies by the [parser](parser)
2. **Parent-child containment** — any node with a `parent` field gets a weighted edge (weight 3 via `EDGE_TYPE_WEIGHTS.contains`) to its parent, pulling them close in the force layout
3. **Orphan rescue** — nodes with zero edges are auto-connected to a same-cluster sibling or the graph hub, preventing unreachable dead-ends

The physics drift bug (fixed in `625f054` and `8cf5034`) required killing physics after every DataSet update — without this, nodes would slowly creep across the canvas after stabilization.

```typescript
export function buildGraph(nodes: KBNode[], clusters: Cluster[]): KBGraph {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const edges = buildEdges(nodes, nodeMap);
  // orphan rescue: connect isolated nodes to cluster siblings or hub
  const related = computeRelated(nodes, edges);
  return { nodes, edges, clusters, related };
}
```

## Weighted Related-Node Ranking

`computeRelated()` builds a per-node adjacency map carrying the highest edge weight between each pair, then sorts neighbors by weight (descending) with degree as tie-breaker — up to 12 neighbors per node. This ranking was redesigned in [#52](https://github.com/anokye-labs/kbexplorer-template/issues/52) so strongly-typed edges (like `contains` at weight 3) outrank weak high-degree connections. Results populate the [HUD](hud) connections panel via [NodeVisual](node-visual).

## Hub Detection

`getHubNodeId()` prefers the `readme` node, then `overview`, otherwise the highest-degree node. This ensures the landing page is always the most connected node. The [application shell](app-shell) calls this to determine the initial route. Changed in commit `5c37867` to default to overview instead of readme.

## Cluster Collapse

The cluster collapse feature ([#57](https://github.com/anokye-labs/kbexplorer-template/issues/57), [#58](https://github.com/anokye-labs/kbexplorer-template/issues/58)) collapses all nodes in a cluster into a single summary node, reducing visual clutter. The [graph network](graph-network) factory and [node renderer](node-renderer) cooperate to draw collapsed clusters with a stacked appearance.
