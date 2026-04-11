---
id: "node-renderer"
title: "Custom Node Renderer"
emoji: "PaintBrush"
cluster: visual
connections: []
---


# Custom Node Renderer

The node renderer (`src/engine/nodeRenderer.ts`), called by the [graph network factory](graph-network), draws Fluent-style shapes with embedded icon SVGs on the vis-network canvas, forming part of the [visual system](visual-system).

## How It Works

The [graph engine](graph-engine) delegates node drawing to this renderer. vis-network's `shape: 'custom'` + `ctxRenderer` callback gives full control over node appearance. Each node gets:

1. **Opaque background fill** — theme-aware (`#1f1f1f` dark, `#ffffff` light) so edges don't bleed through
2. **Cluster-colored overlay** — semi-transparent fill using the node's cluster color
3. **Shape** — determined by icon type: circles (Sparkle, Flag, Lightbulb), rounded squares (Wrench, Bug), rounded rects (Document, Folder)
4. **Icon SVG** — drawn as a data URI image at 55% of node size
5. **Label** — rendered by the ctxRenderer itself (vis-network's built-in labels don't work with custom shapes)

## Emphasis

When `emphasizeNodeId` is set in graph options, non-neighbor nodes render at 60% size and 30% opacity with hidden labels. This creates the Okoto-style focus effect.

## Disconnected Warning

Nodes with zero edges display a red `!` badge at their top-right corner.

## Icon Registry

`ICON_PATHS` maps icon names to SVG path data extracted from @fluentui/react-icons source. `ICON_NODE_SHAPE` maps each icon to its shape type. Both are used by the [HUD](hud) minimap canvas renderer as well.
