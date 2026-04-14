---
id: "visual-system"
title: "Visual System"
emoji: "DesignIdeas"
cluster: visual
derived: true
connections: []
---

The visual system (`src/styles/visuals.css`) coordinates how nodes appear across seven rendering surfaces. It was one of the four core modules built in [PR #4](https://github.com/anokye-labs/kbexplorer-template/pull/4) and refreshed with Fluent 2 in [PR #21](https://github.com/anokye-labs/kbexplorer-template/pull/21). The visual identity issue ([#9](https://github.com/anokye-labs/kbexplorer-template/issues/9)) defined the original 4-modes × 7-surfaces matrix.

## Seven Surfaces

| Surface | Component | Rendering |
|---------|-----------|-----------|
| Card grid | [Overview View](overview-view) | Fluent Card with emoji |
| Reading hero | [Reading View](reading-view) | Large icon + title |
| Connections panel | [HUD](hud) | Small [NodeVisual](node-visual) cards |
| Constellation nodes | [Graph Network](graph-network) | Canvas via [Node Renderer](node-renderer) |
| Minimap dots | [HUD](hud) | Canvas circles |
| Breadcrumbs | Navigation bar | Inline icon + text |
| Search results | Filter panel | Compact list items |

## Four Modes

Each surface renders nodes in one of four visual modes: **Normal** (standard cluster color), **Emphasized** (brighter, larger when selected), **Faded** (dimmed when another node is emphasized), and **Disconnected** (dashed borders for orphan nodes). The emphasis/fade system is in the [graph network](graph-network) factory's `setEmphasis()` function.

## Icon System

Fluent icons from `@fluentui/react-icons` are sourced and colored with cluster color — never monochrome. The [node renderer](node-renderer) embeds 150+ icon SVG paths and renders them as SVG data URIs on canvas. The authored mode ([#17](https://github.com/anokye-labs/kbexplorer-template/issues/17)) established the emoji-per-node convention in frontmatter.

## Integration

The visual system sits between the [theme system](theme-system) (which provides color tokens) and the [style system](style-system) (which applies layout). The [loading and error screens](loading-error-screens) also follow the visual system's patterns.
