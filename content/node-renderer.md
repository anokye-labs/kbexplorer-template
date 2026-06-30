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

`createNodeRenderer()` returns a vis-network `ctxRenderer` — a draw function vis-network calls for each node on every frame with a single args object (`{ ctx, x, y, state, style }`):

```typescript
function createNodeRenderer(
  iconName: string | undefined, // Fluent icon name (e.g., "Flash", "Code"), or none
  clusterColor: string,         // Cluster color hex
  nodeSize: number,             // Node diameter in pixels
  theme: NodeThemeSource,       // Resolved theme-source (foreground/background/icon)
  label?: string,               // Optional text label
  disconnected?: boolean,
): (args: { ctx: CanvasRenderingContext2D; x: number; y: number; state: { selected: boolean; hover: boolean }; style: { size: number } }) => {
  drawNode?: unknown;
  drawExternalLabel?: unknown;
  nodeDimensions: { width: number; height: number };
}
```

The renderer paints a rounded shape (circle, rounded square, or rounded rectangle depending on icon type), fills it with the cluster color at reduced opacity, then draws the Fluent icon as an SVG data URI overlay. Labels render below the shape in the current theme's foreground color.

## Shape System

The `ICON_NODE_SHAPE` map determines which shape each icon gets. The `inferNodeShape()` helper provides defaults — most icons render as circles, but document-related icons use rounded rectangles. This was part of the graph node shapes work in [PR #28](https://github.com/anokye-labs/kbexplorer-template/pull/28), which also added the overlay animation system.

## Icon Library

The renderer embeds 150+ Fluent UI icon SVG paths in the `ICON_PATHS` dictionary — a subset of `@fluentui/react-icons` hand-selected for the knowledge graph use case. `getIconImage()` converts each icon to a canvas-drawable `Image` via SVG data URI construction and caches the result for performance. Icons are colored with their cluster color — never monochrome.

## Host Theme-Source Bridge

Rather than branching on a binary `isDark` flag, the renderer paints from a resolved `NodeThemeSource` (`{ isDark, foreground, background, iconColor }`). `resolveNodeTheme(root, isDarkHint)` reads `--colorNeutralForeground2` / `--colorNeutralBackground1` off the graph container — which inherits the active `FluentProvider` (or a canvas host's mirrored) token variables — and derives `isDark` from the background's perceived luminance. Unset variables fall back to the prior dark/light hardcodes selected by `isDarkHint`. This lets the constellation adopt a host theme with no fork, while `hexToRgba()` still adjusts fill and stroke opacity so nodes stay visible on any background.

## Integration

The renderer is consumed exclusively by the [graph network](graph-network) factory's `buildVisNode()` function. Each node gets its own renderer instance, configured with the node's emoji and cluster color. The [HUD](hud) minimap uses a simplified version for its smaller display. The [visual system](visual-system) coordinates which icon surfaces use which rendering path.
