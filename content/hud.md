---
id: "hud"
title: "HUD & Minimap"
emoji: "Map"
cluster: ui
derived: true
connections: []
---

The HUD (`src/components/HUD.tsx`) is the persistent sidebar that provides orientation and navigation throughout kbexplorer. It contains the minimap constellation, related node panels, layer toggles, cluster collapse controls, and docking options. It is always visible regardless of which view is active — this is what makes it a heads-up display rather than a simple sidebar.

## Minimap

The minimap renders a small-scale version of the full constellation using a `<canvas>` element. The `drawMinimap` function reads positions from `computeGraphPositions()` in the [graph network](graph-network) module and draws nodes as colored dots. The current node is highlighted, giving spatial context for where you are in the graph. The minimap uses one canvas ref per dock orientation (vertical vs horizontal) — when the dock switches, the canvas unmounts and remounts, and the draw effect re-fires via `dock` in the dependency array.

## Layer Toggles

Added in [#55](https://github.com/anokye-labs/kbexplorer-template/issues/55) as part of the sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)), layer toggles show/hide groups of node types: Content (authored), File (source), Work (issues/PRs), and Concept. This filters the graph without changing the underlying data — nodes are hidden at the vis-network level.

## Cluster Collapse

Clicking a cluster label collapses all its nodes into a single summary node ([#57](https://github.com/anokye-labs/kbexplorer-template/issues/57), [#58](https://github.com/anokye-labs/kbexplorer-template/issues/58)). The [node renderer](node-renderer) draws collapsed clusters with a stacked appearance. This dramatically reduces visual clutter for large clusters.

## Related Panel

The related panel shows up to 12 neighboring nodes for the currently selected node, rendered as [NodeVisual](node-visual) cards. The ranking weights edge type then degree — strongly-typed edges (like `contains`) outrank weak links, as redesigned in [#52](https://github.com/anokye-labs/kbexplorer-template/issues/52).

## Dock Positions

The HUD can dock to left, right, bottom, or top. Dock position persists in localStorage. The dock rework in [PR #28](https://github.com/anokye-labs/kbexplorer-template/pull/28) added depth controls and overlay animation alongside the docking system. The [style system](style-system) provides the CSS for each dock variant.

## Neighborhood View

The active node neighborhood view ([#59](https://github.com/anokye-labs/kbexplorer-template/issues/59)) filters the minimap to show only the N-hop neighborhood of the focused node, reducing information overload in dense graphs.

```typescript
<HUD graph={graph} activeNodeId={currentId} onNodeClick={navigateToNode} dock={dockPosition} />
```

The [application shell](app-shell) renders the HUD at the top level so it persists across view transitions.
