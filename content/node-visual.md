---
id: "node-visual"
title: "Node Visual"
emoji: "Sparkle"
cluster: ui
derived: true
connections: []
---

NodeVisual (`src/components/NodeVisual.tsx`) is the reusable card component that represents a single knowledge graph node across multiple surfaces in the UI. It displays the node's emoji icon colored by cluster, the title, and optional metadata — and it is clickable for navigation.

## Where It Appears

NodeVisual is used in four places, each rendering it at a different scale:

1. **[Overview View](overview-view)** — as cards in the cluster-grouped grid
2. **[Reading View](reading-view)** — in the connections panel and breadcrumb
3. **[HUD](hud)** — in the related nodes panel (compact size)
4. **Search results** — when filtering nodes (inline size)

Each surface may render NodeVisual differently, but the component adapts using Fluent tokens rather than pixel values — per the AGENTS.md no-pixels rule.

## Rendering

The component renders a Fluent `Card` with:
- An icon from the [node renderer](node-renderer)'s icon library, colored with the node's cluster color
- The node title as a `Body1` text element
- Optional connection count badge via `CounterBadge`

```typescript
function NodeVisual({ node, onClick, size }: NodeVisualProps) {
  // Renders cluster-colored icon + title + optional badges
  // onClick navigates to #/node/{id}
}
```

## Cluster Colors

Colors come from the cluster definitions in the [type system](type-system). Each cluster has a hex color that flows through the icon, card border glow (on hover), and the connection count badge. [PR #5](https://github.com/anokye-labs/kbexplorer-template/pull/5) introduced the card grid with hover effects (border glow + lift), and [PR #21](https://github.com/anokye-labs/kbexplorer-template/pull/21) refreshed everything with Fluent 2 components.

## Integration

The component is stateless — it receives a `KBNode` and rendering options as props. The [overview view](overview-view), [reading view](reading-view), and [HUD](hud) all import and render NodeVisual with their specific layout requirements.
