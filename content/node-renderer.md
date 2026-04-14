---
id: "node-renderer"
title: "Node Renderer"
emoji: "PaintBrush"
cluster: visual
derived: true
connections: []
---

The node renderer (`src/engine/nodeRenderer.ts`) is the custom canvas drawing engine that paints every node in the constellation graph. Instead of using vis-network's built-in shapes, kbexplorer draws Fluent UI icons directly onto the HTML5 canvas — this gives pixel-perfect control over icon rendering, shape variants, and dark/light mode adaptation that the built-in shapes can't achieve.

## How It Works

`createNodeRenderer()` returns a draw function that vis-network calls for each node on every frame:

```typescript
function createNodeRenderer(
  iconName: string,   // Fluent icon name (e.g., "Flash", "Code")
  color: string,      // Cluster color hex
  size: number,       // Node radius in pixels
  isDark: boolean,    // Dark mode flag
  label?: string,     // Optional text label
  disconnected?: boolean
): (ctx: CanvasRenderingContext2D, x: number, y: number) => void
```

The renderer paints a rounded shape (circle, rounded square, or rounded rectangle depending on icon type), fills it with the cluster color at reduced opacity, then draws the Fluent icon as an SVG data URI overlay. Labels render below the shape in the current theme's foreground color.

## Shape System

The `ICON_NODE_SHAPE` map determines which shape each icon gets. The `inferNodeShape()` helper provides defaults — most icons render as circles, but document-related icons use rounded rectangles. This was part of the graph node shapes work in [PR #28](https://github.com/anokye-labs/kbexplorer-template/pull/28), which also added the overlay animation system.

## Icon Library

The renderer embeds 150+ Fluent UI icon SVG paths in the `ICON_PATHS` dictionary — a subset of `@fluentui/react-icons` hand-selected for the knowledge graph use case. `getIconImage()` converts each icon to a canvas-drawable `Image` via SVG data URI construction and caches the result for performance. Icons are colored with their cluster color — never monochrome.

## Dark Mode Rendering

In dark mode, background fills use lighter opacity and icon strokes invert. The `isDark` parameter flows from the [theme system](theme-system) through the [graph network](graph-network) factory. The `hexToRgba()` helper adjusts fill and stroke colors accordingly — without this, nodes would be invisible on dark backgrounds.

## Integration

The renderer is consumed exclusively by the [graph network](graph-network) factory's `buildVisNode()` function. Each node gets its own renderer instance, configured with the node's emoji and cluster color. The [HUD](hud) minimap uses a simplified version for its smaller display. The [visual system](visual-system) coordinates which icon surfaces use which rendering path.
