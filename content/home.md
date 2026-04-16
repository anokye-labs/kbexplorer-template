---
title: Welcome to kbexplorer
emoji: Home
cluster: guide
display: homepage
connections:
  - to: readme
    type: references
    description: Repository README
  - to: graph-engine
    type: references
    description: Core graph engine
  - to: graph-network
    type: references
    description: Constellation visualization
  - to: hud
    type: references
    description: HUD & navigation
  - to: content-pipeline
    type: references
    description: Content processing
  - to: overview-view
    type: references
    description: Card overview
  - to: reading-view
    type: references
    description: Deep-dive reading
  - to: wiki-knowledge-graph
    type: references
    description: What is a knowledge graph?
  - to: local-loader
    type: references
    description: Provider pipeline
  - to: design-decisions
    type: references
    description: Design philosophy
---

Knowledge lives in many places. Source code in one repository, issues in another, design decisions in a document, architectural context in a pull request thread, tribal knowledge in someone's head. Each system of record captures a piece of the truth — but the connections between them are invisible. You can find the issue, but not the PR that resolved it, the files it changed, the Wikipedia concept it implements, or the design decision that motivated it.

**kbexplorer** builds a [knowledge graph](wiki-knowledge-graph) overlay across these isolated islands of information, making the interconnections between them navigable for both humans and agents.

## How it works

kbexplorer connects to multiple **node providers** — systems of record like GitHub, authored documentation, Wikipedia, organizational charts — and pulls their data into a unified graph. The [provider pipeline](local-loader) merges nodes from every source, and the [graph engine](graph-engine) discovers relationships: inline references, cross-links, shared identities, structural containment. What emerges is a [constellation](graph-network) where every node connects to the things that give it meaning.

The [GitHub provider](github-api) brings in issues, pull requests, source trees, and commit history. The [authored provider](content-pipeline) processes markdown content with YAML frontmatter. External providers reach beyond the repo — [Wikipedia articles](wiki-knowledge-graph) for conceptual grounding, organizational charts for team structure, or any data source you wire up.

## Three ways to explore

The [constellation graph](graph-network) is the signature view — a [force-directed](wiki-force-directed-graph-drawing) visualization where nodes cluster by theme and edges reveal relationships across systems of record. Follow an edge from a design decision to the PR that implemented it to the source files it changed.

The [reading view](reading-view) is for depth. Click any node and its full content unfolds — rendered with inline links that connect you to every other node it touches. Related nodes appear in the sidebar. You're never more than one click from context.

The [card overview](overview-view) is for breadth. Every node as a card, grouped by cluster, scannable at a glance. When you need to answer "what's in this knowledge base?" — start here.

## Why a graph overlay

The value isn't in any single system of record — it's in the connections between them. An issue references a file. A PR closes that issue and modifies three modules. A Wikipedia article explains the algorithm those modules implement. A design decision document captures *why* that algorithm was chosen over alternatives.

These relationships exist, but they're scattered across tools that don't talk to each other. kbexplorer surfaces them as typed, weighted edges in a navigable graph. The [HUD](hud) gives you layer toggles, cluster collapse, a detail slider, and multi-tier edge importance that fades distant connections while keeping your neighborhood sharp.

kbexplorer enforces [graph constraints](design-decisions): no orphan nodes, every node within three hops of the hub, edges typed and weighted so the constellation is a legible map — not a hairball.

## Start exploring

Pick a cluster chip above, click into a curated node, or open the constellation and follow the edges. The graph is yours to explore.
