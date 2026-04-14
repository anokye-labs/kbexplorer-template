---
id: "wiki-deep-dive"
title: "Architecture Deep Dive"
emoji: "Search"
cluster: guide
derived: true
connections: []
---

Full architecture trace from startup to rendering. Read the [overview](overview) first, or the [welcome page](wiki-overview) for a user-oriented introduction.

## Startup Sequence

1. [Application shell](app-shell) mounts, calls the [KB loader hook](kb-loader)
2. Hook detects mode — [local loader](local-loader) or [GitHub API](github-api)
3. [Providers](providers-overview) are registered and run by the [orchestrator](orchestrator)
4. [Parser](parser) processes markdown, issues, file trees into `KBNode[]`
5. [Graph engine](graph-engine) computes edges, clusters, related nodes
6. Shell renders the appropriate view

## The Type Foundation

Everything builds on the [type system](type-system). `KBNode`, `KBEdge`, `KBGraph`, `Cluster` flow through every module.

## The Identity Problem

Multiple providers can produce nodes for the same entity. The [identity system](identity) assigns URN strings so the graph recognizes duplicates. The [multi-layer identity spec](multi-layer-identity) explains the design.

## Edge Discovery

Edges come from: frontmatter connections, [inline links](inline-link-extraction), issue cross-references, import analysis via [node mapping](node-mapping), and structural containment. The [typed edges spec](typed-edges) categorizes each.

## Rendering Stack

The [visual system](visual-system) coordinates seven surfaces. The [node renderer](node-renderer) draws Fluent icons on canvas. The [theme system](theme-system) provides three palettes. The [style system](style-system) handles layout.

## Design Rationale

Key decisions are in the [design decisions](design-decisions) node. The [link assessment spec](spec-link-assessment) defines quality metrics for graph health.
