---
id: "graph-network"
title: "Graph Network"
emoji: "Organization"
cluster: engine
derived: true
connections: []
---

The graph network factory (`src/engine/createGraphNetwork.ts`) bridges the abstract `KBGraph` from the [graph engine](graph-engine) and the visual vis-network library that renders the interactive constellation. It creates vis-network `Network` instances, configures physics, and manages the emphasis system that highlights a node's neighborhood when hovered.

## Creating a Network

`createGraphNetwork()` accepts a `GraphNetworkOptions` object (container element, graph data, theme flag, callbacks) and returns a `GraphNetworkResult`:

```typescript
export interface GraphNetworkResult {
  network: Network;
  nodes: DataSet<Record<string, unknown>>;
  edges: DataSet<Record<string, unknown>>;
  setEmphasis: (nodeId: string | null) => void;
}
```

The factory builds vis-nodes via `buildVisNode()`, which delegates to the [node renderer](node-renderer) for custom canvas drawing. Node sizes scale with degree — more connections mean a larger node. Hub nodes (top 8 by degree via `computeKeyNodes()`) get a 1.5× base size boost, giving visual weight to landing-page nodes like [overview](overview).

## Physics and Stabilization

The network uses barnesHut gravity with force-directed layout. After stabilization completes, physics is **killed** to prevent drift. This was a hard-won fix: commits `625f054` and `8cf5034` addressed a bug where nodes slowly crept across the canvas after every DataSet update. The solution: disable physics in the factory configuration *and* again after emphasis updates.

## Emphasis System

`setEmphasis(nodeId)` highlights a node and its direct neighbors at full opacity while fading everything else. This updates vis-network DataSet objects for both nodes and edges. The [HUD](hud) triggers emphasis on hover, creating a focus-plus-context effect. Passing `null` resets all nodes to full opacity.

## Edge Styling

Edges render per type using `EDGE_TYPE_STYLES` from the [type system](type-system). Different edge types get distinct colors, dash patterns, and arrow styles — implemented as part of [#56](https://github.com/anokye-labs/kbexplorer-template/issues/56). This makes it visually obvious whether a connection is containment, reference, or cross-reference.

## Position Computation

`computeGraphPositions()` creates a hidden off-screen vis-network to compute force-directed layout positions without rendering. It calls back with a position map used by the [HUD](hud) minimap's `drawMinimap` function. The returned cleanup function destroys the hidden network to prevent memory leaks. The `dock` value is in the dependency array so positions recompute when the dock orientation changes.
