---
id: "wiki-visual-system"
title: "Visual System Guide"
emoji: "Eye"
cluster: guide
derived: true
connections: []
---

The [visual system](visual-system) defines how nodes look across seven rendering surfaces.

## The Seven Surfaces

| Surface | Component | Rendering |
|---------|-----------|-----------|
| Card grid | [Overview View](overview-view) | Fluent Cards with emoji |
| Reading hero | [Reading View](reading-view) | Large icon header |
| Connections | [HUD](hud) | Compact [NodeVisual](node-visual) cards |
| Constellation | [Graph Network](graph-network) | Canvas via [Node Renderer](node-renderer) |
| Minimap | [HUD](hud) | Colored dots |
| Breadcrumbs | Navigation | Inline icon + text |
| Search | Filter panel | Compact list items |

## Icons

Fluent icons colored with cluster color — never monochrome. The [node renderer](node-renderer) embeds 150+ SVG paths.

## Cluster Colors

| Cluster | Color |
|---------|-------|
| Engine | #4A9CC8 |
| Interface | #8CB050 |
| Visual | #E8A838 |
| Data | #C07840 |
| Infrastructure | #5A98A8 |
| Design | #A86FDF |
| Guide | #39FF14 |

## Emphasis and Fading

Hover a node → [graph network](graph-network)'s `setEmphasis()` highlights it and neighbors, fading everything else.

## Sizing Rules

Per AGENTS.md: no pixels for layout dimensions. Use viewport units, percentages, or Fluent tokens. The [style system](style-system) enforces this. The [theme system](theme-system) provides the color foundation.
