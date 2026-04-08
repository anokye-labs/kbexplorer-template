---
id: hud
title: "HUD — Heads-Up Display"
emoji: "Pin"
cluster: ui
connections:
  - to: graph-engine
    description: "renders graph from"
  - to: node-renderer
    description: "uses for constellation"
  - to: theme-system
    description: "themed by"
  - to: overview
    description: "primary navigation for"
  - to: file-src/components/HUD.tsx
    description: "implemented in"
---

# HUD — Heads-Up Display

The HUD (`src/components/HUD.tsx`) is the persistent control surface visible across all reading views. It adapts its layout based on dock position.

## Sidebar Layout (Left/Right Dock)

Inspired by Okoto's sidebar, the vertical layout has three zones:

1. **Live constellation** — a full vis-network graph instance occupying ~50% of the sidebar height. Interactive — click a node to navigate. Physics freeze after stabilization. Current node + neighbors are emphasized (full opacity/size), everything else fades to 30%.

2. **Connections panel** — scrollable list of related nodes as cards with icon, title, description snippet, and cluster color bar. A row-resize handle between the graph and connections allows adjusting the split (20%–80%, persisted).

3. **Tools strip** — compact bottom row with theme toggle (dark/light/sepia), dock position buttons, Aa font size slider, and Width slider.

The sidebar width defaults to 25vw, resizable 15–50vw via a col-resize handle on the inner edge.

## Horizontal Layout (Top/Bottom Dock)

The horizontal layout uses a three-panel row: minimap canvas (left), navigation + related nodes strip (center), reading tools (right).

## Constellation Overlay

Clicking the MAP button (horizontal dock) opens a full-screen overlay with the same vis-network graph, floating cluster legend, and bounded panning.

## Persistence

Dock position, collapsed state, sidebar width, graph/connections split, font size, and column width are all persisted in localStorage.
