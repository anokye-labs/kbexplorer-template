---
id: "overview-view"
title: "Overview View"
emoji: "Grid"
cluster: ui
derived: true
connections: []
---

The overview view (`src/views/OverviewView.tsx`) is the landing page of kbexplorer — a card grid that groups all knowledge nodes by cluster, giving users an instant map of the entire system. It was introduced in [PR #5](https://github.com/anokye-labs/kbexplorer-template/pull/5) and refreshed with Fluent 2 components in [PR #21](https://github.com/anokye-labs/kbexplorer-template/pull/21).

## Layout

Nodes are grouped by cluster and rendered as a responsive grid of [NodeVisual](node-visual) cards. Each cluster section has a header with the cluster name, color badge, and node count. The grid uses Fluent `makeStyles` with CSS Grid for responsive layout — Desktop (>1024px): 3-4 columns, Tablet (768-1024px): 2 columns, Mobile (<768px): 1 column. The responsive breakpoints were audited in [PR #18](https://github.com/anokye-labs/kbexplorer-template/pull/18).

## Card Interactions

Each card shows the node's emoji icon (colored by cluster), title, and connection count. Hover effects include a border glow in the cluster color and a subtle lift. Clicking a card navigates to the [reading view](reading-view) via hash routing.

```typescript
<NodeVisual node={node} onClick={() => navigate(`#/node/${node.id}`)} size="medium" />
```

## Data Source

The view receives the complete `KBGraph` from the [application shell](app-shell), which gets it from the [KB loader](kb-loader). Cluster definitions come from the [type system](type-system). No additional data fetching happens — it is purely a presentation component.

## Cluster Ordering

Clusters appear in the order defined by `config.yaml`. Within each cluster, nodes are sorted alphabetically by title. The `CounterBadge` shows the total connection count per node, giving a quick density signal.
