---
id: "overview"
title: "kbexplorer Architecture"
emoji: "Globe"
cluster: guide
derived: true
connections: []
---

kbexplorer is a React 19 + TypeScript application that transforms any GitHub repository into an interactive, explorable knowledge graph. It fetches content from the [GitHub API](github-api) at runtime — issues, README, file tree — and renders it as a constellation of interconnected nodes. Users browse through a card-based [overview grid](overview-view), a force-directed [constellation graph](graph-network), and an immersive [reading view](reading-view), all orchestrated by the persistent sidebar [HUD](hud).

## How It Works

At startup the [application shell](app-shell) boots the UI while the [KB loader](kb-loader) calls the [GitHub API](github-api) to fetch repository data. The [content pipeline](content-pipeline) routes raw responses through the [orchestrator](orchestrator), which coordinates [providers](providers-overview) and the [parser](parser) to produce typed `KBNode[]` arrays. The [graph engine](graph-engine) then computes edges, clusters, and related-node rankings. For offline or CI workflows, the [manifest generator](manifest-generator) pre-builds a content snapshot so the [local loader](local-loader) can hydrate the entire graph with zero API calls (PR #38).

```typescript
const { graph, config } = await loadLocalKnowledgeBase();
// graph.nodes, graph.edges, graph.clusters — ready to render
```

## The Visual Experience

Every node passes through the [custom node renderer](node-renderer), which paints Fluent icons onto the HTML canvas. The [visual system](visual-system) coordinates display across seven surfaces, while the [theme system](theme-system) offers dark, light, and sepia palettes. The Fluent 2 refresh (PR #20, PR #21) replaced all custom CSS with `@fluentui/react-components` tokens.

## The Graph Engine

The [type system](type-system) defines the data model and the [graph engine](graph-engine) computes relationships. The [HUD](hud) exposes the result as a minimap and dock. The sense-making epic (#54) added layer toggles, cluster collapse, and neighborhood views.

## Architecture Roadmap

The codebase is evolving toward a pluggable [provider architecture](providers-overview). The [provider spec](spec-providers-overview) describes the vision, [node mapping](spec-node-mapping) defines how files become nodes, and the [views spec](spec-views) formalizes projections. Issue #40 tracks the full evolution.

## Getting Started

New here? Start with the [welcome page](wiki-overview) or the [getting started guide](wiki-getting-started). Explore [theming](wiki-theming) and the [visual system guide](wiki-visual-system). For architecture, read the [deep dive](wiki-deep-dive).

## Stack

- **React 19** + TypeScript + Vite 8
- **@fluentui/react-components** v9 — Fluent 2 design system
- **vis-network** + vis-data — force-directed graph visualization
- **Azure Static Web Apps** — deployment target
- **GitHub REST API** — runtime content source
