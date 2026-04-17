---
title: Card Overview
emoji: Grid
cluster: ui
connections:
  - to: overview-view
    type: references
    description: OverviewView component
  - to: ui-constellation
    type: references
    description: Alternative to graph view
  - to: home
    type: references
    description: Homepage curated picks
---

The card overview presents every node in the knowledge base as a browseable card grid, grouped by cluster. Access it via the **Cards** button in the HUD or by navigating to `#/overview`.

![Card overview grouped by cluster](screenshots/15-overview-cards.png)

## When to use it

The constellation graph rewards exploration — you follow edges and discover connections. The card overview is for **scanning** — when you need to answer "what's in this knowledge base?" without navigating the graph.

Each card shows the node's icon, title, connection count, and cluster badge. Click any card to navigate to that node's full reading view.

## Cluster grouping

Cards are grouped by cluster with a color-coded header. Clusters with more nodes appear first. The stats line at the top shows total node, edge, and cluster counts for the current view.

## Relationship to homepage

The [homepage](home) shows a **curated subset** of these cards — the top 2 nodes per cluster plus all external references. The full overview shows everything.
