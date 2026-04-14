---
id: "style-system"
title: "Style System"
emoji: "PaintBrush"
cluster: visual
derived: true
connections: []
---

The style system (`src/styles/hud.css` and related CSS files) provides the layout and visual polish layer for kbexplorer's custom components. While Fluent UI handles component-level styling, the style system manages layout grids, the HUD sidebar, graph overlays, and prose typography.

## Architecture

The style system operates at three levels:

1. **Fluent tokens** — colors, spacing, and typography from the [theme system](theme-system) via `FluentProvider`
2. **CSS variables** — custom properties like `--kb-prose-font-size` that Fluent doesn't cover
3. **Component CSS** — layout-specific rules for the [HUD](hud), graph view, and prose areas

## HUD Styles

`hud.css` defines the sidebar layout, minimap canvas sizing, dock position variants, and layer toggle button styles. The major HUD rework in [PR #28](https://github.com/anokye-labs/kbexplorer-template/pull/28) added depth/collapse/dock controls. The sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)) brought layer toggles ([#55](https://github.com/anokye-labs/kbexplorer-template/issues/55)) and edge type styling ([#56](https://github.com/anokye-labs/kbexplorer-template/issues/56)).

## Responsive Design

The responsive layout audit ([PR #18](https://github.com/anokye-labs/kbexplorer-template/pull/18)) established three breakpoint tiers: Desktop (>1024px), Tablet (768-1024px), and Mobile (<768px). All views — [overview](overview-view), [reading](reading-view), and graph — adapt within these breakpoints.

## No Pixels for Sizing

Per AGENTS.md rules, layout dimensions use viewport units (`vw`, `vh`), percentages, or Fluent tokens — **never pixels**. The only exception is borders (`1px solid`). This ensures the UI scales across screen sizes.

## Integration

The style system is consumed by the [visual system](visual-system), the [node renderer](node-renderer), and all view components. The [theme system](theme-system) drives the color tokens. The typed edges visual styling ([#50](https://github.com/anokye-labs/kbexplorer-template/issues/50)) added edge-type-specific colors coordinated between CSS and the [graph network](graph-network) factory.
