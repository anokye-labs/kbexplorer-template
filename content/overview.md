---
id: "overview"
title: "kbexplorer Architecture"
emoji: "Building"
cluster: engine
connections: []
---


# kbexplorer

**kbexplorer** is a React + TypeScript application that turns any GitHub repository into an interactive, explorable knowledge graph. It fetches content from the GitHub API at runtime — issues, README, file tree — and presents it as a constellation of interconnected nodes navigable through a reading view, a force-directed network, and a persistent sidebar [HUD — Heads-Up Display](hud).

At startup the [application shell](app-shell) boots the UI while the [KB loader](kb-loader) fetches content. The [content pipeline](content-pipeline) transforms raw API responses into typed nodes — shapes defined by the [type system](type-system) — and feeds them to the [graph engine](graph-engine). The [visual system](visual-system) renders node icons across every surface, themed by the [theme system](theme-system).

## Inspirations

The project synthesizes patterns from three knowledge explorer prototypes:

- **Claws** — structured KB browser for fast retrieval with deep-dive cards
- **Mukaase** — narrative reader treating content as linked prose with a persistent control bar
- **Okoto** — interactive walkthrough engine with a sidebar constellation graph and parent/section node hierarchy

## Stack

- **React 19** + TypeScript + Vite 8
- **@fluentui/react-components** v9 — Fluent 2 design system
- **vis-network** + vis-data — force-directed graph visualization
- **Azure Static Web Apps** — deployment target
- **GitHub REST API** — runtime content source
