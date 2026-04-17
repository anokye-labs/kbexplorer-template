---
title: Dock Positions & Layout
emoji: PanelLeft
cluster: ui
connections:
  - to: hud
    type: references
    description: HUD docking system
  - to: reading-view
    type: references
    description: Content reflows with dock
  - to: ui-constellation
    type: references
    description: Graph appears in sidebar docks
---

The HUD can dock to any edge of the screen — left, right, bottom, or top. Each position changes how the constellation graph, connections panel, and reading tools are arranged.

## Left dock (sidebar)

The default for graph exploration. The constellation renders in the upper portion with a resizable split, and connections + reading tools stack below.

![Left dock with sidebar graph](screenshots/02-sidebar-graph-dark.png)

## Right dock

Same sidebar layout, mirrored. Content flows to the left with the graph on the right. Useful for right-to-left reading preference or wide monitors.

![Right dock](screenshots/17-dock-right.png)

## Bottom dock

A horizontal strip along the bottom with the minimap, navigation controls, related nodes, and theme/dock buttons in a compact row. Maximizes vertical reading space.

![Bottom dock](screenshots/16-dock-bottom.png)

## Reading controls

In sidebar mode (left/right), the HUD includes:
- **Font size slider** (Aa) — adjusts prose text size
- **Column width slider** — controls how wide the prose column stretches

![Narrow width with large font](screenshots/18-narrow-large-font.png)

These settings persist across sessions and work on every page, including the [homepage](home).

## Switching docks

All four dock positions are reachable from any layout via the dock buttons (panel icons). The current dock highlights with the primary color. Position persists across page reloads.
