---
id: "wiki-visual-system"
title: "Visual System"
emoji: "Book"
cluster: guide
parent: "wiki-deep-dive"
connections:
  - to: "visual-system"
    description: "architecture doc"
  - to: "node-renderer"
    description: "architecture doc"
  - to: "style-system"
    description: "CSS reference"
---



# Visual System

The visual system renders node identity consistently across all surfaces — reading view headers, HUD connection cards, and the constellation graph canvas.

## React Components (NodeVisual)

`NodeVisual` maps icon name strings to Fluent icon React components via a `FLUENT_ICONS` registry. Every icon renders in its **cluster color** via the `clusterColor` prop, matching the colored enclosures in the graph.

The component handles 7 surfaces with different size presets (80px headers, 48px cards, 44px HUD thumbnails) and falls back to letter-avatars when no icon match exists.

## Canvas Rendering (nodeRenderer)

The graph canvas can't use React components — it needs raw 2D drawing. `nodeRenderer.ts` extracts SVG path data from Fluent icons into `ICON_PATHS`, then draws them as data URI images inside custom shapes:

- **Circles** for Sparkle, Flag, Lightbulb, Pin, Merge, BranchFork
- **Rounded squares** for Wrench, Bug
- **Rounded rectangles** for Document, Folder

Each node gets an opaque background fill (theme-aware) before the semi-transparent cluster color overlay, preventing edge bleed-through.

## Emphasis

When a node is selected, it and its direct neighbors render at full opacity and size. Everything else fades to 30% opacity and 60% size with hidden labels — the Okoto-style focus effect.
