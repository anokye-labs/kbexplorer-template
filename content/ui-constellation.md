---
title: Constellation Graph
emoji: BranchFork
cluster: ui
connections:
  - to: graph-engine
    type: references
    description: Powered by the graph engine
  - to: graph-network
    type: references
    description: vis-network rendering
  - to: hud
    type: references
    description: Embedded in the HUD
  - to: wiki-force-directed-graph-drawing
    type: references
    description: Force-directed layout algorithm
---

The constellation graph is kbexplorer's signature visualization — a force-directed network where every node in the knowledge base becomes a point of light, and every connection becomes a line between them.

## What you see

![Constellation graph in the sidebar with cluster colors and edge types](screenshots/02-sidebar-graph-dark.png)

Nodes are colored by [cluster](design-decisions) and sized by connectivity — the more connections a node has, the larger it appears. Edges are colored by [type](typed-edges): solid lines for containment and imports, dashed for references and mentions. The legend in the upper-left shows which clusters and edge types are active.

## Graph views

Five built-in views filter the constellation to show different slices of the knowledge base:

| View | What it shows |
|------|--------------|
| **All** | Every node and edge |
| **Code** | Source files and code-related content |
| **Docs** | Authored documentation and derived content |
| **Work** | GitHub issues, pull requests, and commits |
| **External** | Wikipedia articles and their connected neighbors |

![Code view filtering](screenshots/06-view-code.png)

## Multi-tier edge importance

When you navigate to a node, edges fade based on their distance from your current position:

- **Direct neighbors** — full color, slightly thicker
- **1-hop bridge** — type color at 50% opacity
- **2-hop bridge** — type color at 25% opacity
- **Distant** — nearly invisible

This keeps the graph readable even with hundreds of edges between visible nodes.

## Detail control

The detail slider in the lower-left controls how many nodes appear — from 5 (minimal overview) to 100 (dense exploration). The trimming algorithm keeps the hub node, your current node's neighbors, at least one node per cluster, and boosts external provider nodes.

## MAP overlay

Click **MAP** to open a full-screen overlay of the constellation with zoom controls and the complete cluster legend.

![MAP overlay with full constellation](screenshots/05-map-overlay.png)
