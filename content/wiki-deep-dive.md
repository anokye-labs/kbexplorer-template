---
id: "wiki-deep-dive"
title: "Architecture Deep Dive"
emoji: "Book"
cluster: guide
connections: []
---



# Architecture Deep Dive

kbexplorer's architecture, introduced in the [architecture overview](overview), has five major subsystems, each covered in detail below.

## [Data Pipeline](wiki-data-pipeline)

Content flows from the GitHub API through a parser that normalizes issues, README, and file tree into `KBNode[]`, then into a graph engine that computes edges, clusters, and related nodes.

## [Visual System](wiki-visual-system)

Nodes render as cluster-colored Fluent icons across all surfaces — reading view, HUD, constellation graph. The graph canvas uses custom vis-network renderers that draw Fluent-shaped enclosures with SVG icons inside.

## [HUD System](wiki-hud-system)

The persistent Heads-Up Display adapts between a horizontal bar (top/bottom dock) and an Okoto-style sidebar (left/right dock) with a live constellation graph.

## [Theme System](wiki-theming)

Three themes (dark, light, sepia) via FluentProvider. All components inherit colors automatically. Sepia uses a custom amber brand ramp.

## [Infrastructure](wiki-infrastructure)

See the [infrastructure documentation](wiki-infrastructure) for details on Azure Static Web Apps deployment, cache versioning, SPA routing, and development conventions codified in AGENTS.md.
