---
id: "design-decisions"
title: "Design Decisions"
emoji: "Building"
cluster: design
connections:
  - to: "overview"
    description: "informs architecture of"
  - to: "graph-engine"
    description: "shaped"
  - to: "hud"
    description: "drove layout of"
---


# Design Decisions

Key architectural choices made during development, driven by user feedback and iterative refinement.

## No Pixels

All layout dimensions use viewport units (`vw`, `vh`), percentages, or Fluent tokens. Never pixels. This ensures the app scales across screen sizes — from 1080p to 4K ultrawide.

## Single Source of Truth for Graph

`createGraphNetwork()` is the sole factory for vis-network instances. The sidebar graph, constellation overlay, and minimap position computation all use this function. Earlier implementations had separate graph-creation code in three places, leading to visual inconsistencies.

## README as Homepage

The README is always the landing page and the conceptual center of the graph. `getHubNodeId()` explicitly prefers the `readme` node over the highest-degree node (which would be `repo-root` due to file containment edges).

## No Separate Overview Page

The original card grid overview was removed. The README reading view serves as the entry point — all navigation flows from there via the HUD connections or the constellation graph.

## Containment Edges Are Strong

Parent→child edges (folders containing subfolders/files) carry weight 3 (3× normal), making them render as shorter springs in the force layout. This keeps hierarchical structures visually clustered.

## Verify Before Declaring Done

Every UI change must be verified with playwright before telling the user it works. Test the actual user flow, not a clean-state shortcut. This lesson was learned painfully through multiple rounds of "it works in my test but not in the user's browser."
