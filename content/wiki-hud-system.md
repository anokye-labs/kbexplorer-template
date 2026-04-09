---
id: "wiki-hud-system"
title: "HUD System"
emoji: "Book"
cluster: guide
parent: "wiki-deep-dive"
connections:
  - to: "hud"
    description: "architecture doc"
---



# HUD System

The HUD (Heads-Up Display) is the persistent control surface visible across all reading views. It adapts its layout based on dock position.

## Sidebar Layout (Left/Right Dock)

The Okoto-inspired vertical layout has three zones stacked vertically:

1. **Live constellation graph** (~50% height) — a full vis-network instance. Click nodes to navigate. Physics freeze after stabilization. Current node emphasized.
2. **Connections panel** (remaining height) — scrollable cards with icon, title, description snippet, and cluster color bar. A row-resize handle between graph and connections allows adjusting the split (20%–80%).
3. **Tools strip** — compact bottom row: theme toggle, dock buttons, font size and width sliders.

Sidebar width defaults to 25vw, resizable 15–50vw via col-resize drag handle.

**Critical optimization:** The sidebar graph creates once and persists across navigation. When the user clicks a node, only `selectNodes()` + `focus()` are called — no rebuild, no re-stabilization.

## Horizontal Layout (Top/Bottom Dock)

Three-panel row: minimap canvas (left), navigation + related strip (center), tools (right). The minimap is a canvas-drawn representation using positions from `computeGraphPositions()`.

## Constellation Overlay

The MAP button opens a full-screen overlay with bounded panning (custom pointer handler clamped to node bounding box), floating cluster legend, and dismiss button.

## Persistence

All HUD state is persisted in localStorage: dock position, collapsed state, sidebar width, graph/connections split, font size, column width.
