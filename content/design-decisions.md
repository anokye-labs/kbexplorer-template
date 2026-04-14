---
id: "design-decisions"
title: "Design Decisions"
emoji: "Lightbulb"
cluster: design
derived: true
connections: []
---

This node documents the key architectural decisions that shaped kbexplorer, explaining not just what was built but **why** each choice was made.

## Single Canvas Rendering

The [node renderer](node-renderer) draws Fluent icons directly onto HTML5 canvas rather than using DOM elements or SVG overlays. **Why**: vis-network's custom rendering API requires a canvas draw function. Using DOM overlays would create thousands of elements that fight with the physics simulation. Canvas gives pixel-perfect control and excellent performance with 100+ nodes.

## Hash-Based Routing

The [application shell](app-shell) uses `#/node/{id}` hash routing instead of HTML5 pushState. **Why**: Azure Static Web Apps requires fallback rules for SPA routing. Hash routing works without server configuration, simplifying development and deployment.

## Provider Architecture

The [provider system](providers-overview) uses pluggable adapters rather than a monolithic loader. **Why**: the Graph Provider Architecture ([#40](https://github.com/anokye-labs/kbexplorer-template/issues/40)) recognized content sources will grow — GitHub, ADO, local files, databases. Each source has different auth, pagination, and caching needs. The [orchestrator](orchestrator) handles ordering; providers handle source logic.

## Typed Edges Over Simple Links

The [typed edges spec](typed-edges) upgraded edges from `{ to, description }` to typed, directional, weighted edges ([#50](https://github.com/anokye-labs/kbexplorer-template/issues/50)). **Why**: edge type drives visual styling, layout physics, and related-panel ranking. Without types, a folder-containment edge and an issue cross-reference look identical.

## Multi-Layer Identity

The [identity system](identity) uses URN-based identities ([#47](https://github.com/anokye-labs/kbexplorer-template/issues/47)). **Why**: the same entity appears as file node, content node, and concept node. URNs let the [graph engine](graph-engine) recognize these as facets of one thing. The [multi-layer identity spec](multi-layer-identity) documents the full rationale.

## Content Derivation

The Content Derivation Engine ([PR #76](https://github.com/anokye-labs/kbexplorer-template/pull/76)) automates content generation from source code. **Why**: hand-authoring 37+ nodes is unsustainable. Derived content stays synchronized and can be re-generated. The [overview](overview) and [catalogue transformer](catalogue-transformer) capture the process.
