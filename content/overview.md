---
id: "overview"
title: "kbexplorer Architecture"
emoji: "Building"
cluster: engine
connections: []
---


# kbexplorer

**kbexplorer** is a React + TypeScript application that turns any GitHub repository into an interactive, explorable knowledge graph. It fetches content from the [GitHub API](github-api) at runtime — issues, README, file tree — and presents it as a constellation of interconnected nodes you can browse through a card-based [overview grid](overview-view), a force-directed [constellation graph](graph-network), and an immersive [reading view](reading-view), all orchestrated by a persistent sidebar [HUD](hud).

## How it works

At startup the [application shell](app-shell) boots the UI while the [KB loader](kb-loader) calls the [GitHub API](github-api) to fetch repository content. The [content pipeline](content-pipeline) transforms raw responses into typed nodes and feeds them to the [graph engine](graph-engine), which computes edges and clusters. For offline or CI workflows, the [manifest generator](manifest-generator) pre-builds a content snapshot so the [local loader](local-loader) can hydrate the entire graph with zero API calls.

## The visual experience

Every node drawn on screen passes through the [custom node renderer](node-renderer), which paints Fluent icons directly onto the HTML canvas for crisp, resolution-independent rendering. The [visual system](visual-system) coordinates icon display across seven surfaces — cards, graph nodes, breadcrumbs, minimap, and more — while the [theme system](theme-system) offers dark, light, and sepia palettes that ripple through every surface at once.

## The graph engine

The [type system](type-system) defines the data model — node kinds, edge semantics, cluster membership — and the [graph engine](graph-engine) uses it to compute relationships and group nodes into navigable clusters. The [HUD](hud) exposes the result as a persistent minimap and dock, giving you orientation no matter how deep you wander.

## Architecture roadmap

The codebase is evolving toward a pluggable provider architecture. The [provider overview](spec-providers-overview) describes the vision: content sources become swappable adapters, [node mapping](spec-node-mapping) defines how raw files become graph nodes, the [graph store](spec-graph-store) spec outlines a durable SQLite backing layer, and the [views spec](spec-views) formalizes projections so new visualizations can be added without touching core logic.

## Getting started

New here? The [getting started guide](wiki-getting-started) walks you through setup, local development, and your first content edit. For a deeper look at how the pieces connect, read the [architecture deep dive](wiki-deep-dive).

## Stack

- **React 19** + TypeScript + Vite 8
- **@fluentui/react-components** v9 — Fluent 2 design system
- **vis-network** + vis-data — force-directed graph visualization
- **Azure Static Web Apps** — deployment target
- **GitHub REST API** — runtime content source

## Inspirations

The project synthesizes patterns from three knowledge explorer prototypes:

- **Claws** — structured KB browser for fast retrieval with deep-dive cards
- **Mukaase** — narrative reader treating content as linked prose with a persistent control bar
- **Okoto** — interactive walkthrough engine with a sidebar constellation graph and parent/section node hierarchy
