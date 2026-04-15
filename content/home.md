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

Every codebase tells a story. Not in its README — those are written once and forgotten. The real story lives in the spaces between: in the issue that sparked a three-week refactor, in the pull request where two approaches collided and a third emerged, in the commit message that says "finally" after twelve attempts.

**kbexplorer** makes that story navigable.

Point it at any GitHub repository and it transforms the raw material of software development — source files, issues, pull requests, commits, and documentation — into an interconnected [knowledge graph](wiki-knowledge-graph). Not a flat wiki. Not a search index. A *constellation* where every node connects to the things that give it meaning.

## Three ways to explore

The [constellation graph](graph-network) is the signature view — a [force-directed](wiki-force-directed-graph-drawing) visualization where nodes cluster by theme and edges reveal relationships you didn't know existed. Zoom in on a cluster of authentication issues and discover they all reference the same three source files. Follow an edge from a design decision to the PR that implemented it.

The [reading view](reading-view) is for depth. Click any node and its full content unfolds — markdown rendered with inline links that connect you to every other node it touches. Related nodes appear in the sidebar. You're never more than one click from context.

The [card overview](overview-view) is for breadth. Every node as a card, grouped by cluster, scannable at a glance. When you need to answer "what's in this knowledge base?" — start here.

## What powers it

Under the surface, a [provider pipeline](local-loader) pulls data from multiple sources and merges it into a unified graph. The [GitHub provider](github-api) fetches issues, PRs, and source trees. The [authored provider](content-pipeline) processes markdown content with YAML frontmatter. External providers bring in knowledge from beyond the repo — [Wikipedia articles](wiki-knowledge-graph), organizational charts, or any data source you wire up.

The [graph engine](graph-engine) builds edges from inline links, cross-references, and structural relationships. The [HUD](hud) gives you layer toggles, cluster collapse, a detail slider from 1 to 100 nodes, and multi-tier edge importance that fades distant connections while keeping your neighborhood sharp.

## Why graphs, not wikis

A wiki is a tree. You start at the root and drill down. If the page you need isn't where you expected it, you search — and searching means you already know what you're looking for.

A graph is different. Graphs reward *wandering*. You start at one node, follow an interesting edge, and arrive somewhere you didn't expect but needed to find. The structure of the graph — which things connect to which — *is* the knowledge. Reachability matters more than hierarchy.

That's why kbexplorer enforces [graph constraints](design-decisions): no orphan nodes, every node within three hops of the hub, edges typed and weighted so the constellation isn't just a hairball but a legible map of how ideas relate.

## Start exploring

Pick a cluster chip above, click into a curated node, or open the constellation and wander. The graph is yours to explore.
