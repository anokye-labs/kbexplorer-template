---
id: "spec-views"
title: "Graph Views Spec"
emoji: "SlideLayout"
cluster: design
derived: true
connections: []
---

The graph views specification defines named view projections over the unified knowledge graph. Tracked in [#44](https://github.com/anokye-labs/kbexplorer-template/issues/44) as part of the Graph Provider Architecture ([#40](https://github.com/anokye-labs/kbexplorer-template/issues/40)).

## Problem

As the graph grows, showing everything overwhelms users. The sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)) addressed this with layer toggles ([#55](https://github.com/anokye-labs/kbexplorer-template/issues/55)) and cluster collapse ([#57](https://github.com/anokye-labs/kbexplorer-template/issues/57)), but these are ad-hoc. Views formalize the concept.

## View Definition

A view specifies: which node types to include (by provider, cluster, or type), which edge types to show, layout preferences, and sort/filter rules.

| View | Shows | Use Case |
|------|-------|----------|
| Architecture | Engine + UI + Data clusters | System overview |
| Work | Issues + PRs only | Sprint planning |
| Files | File tree only | Code navigation |
| Content | Authored nodes only | Documentation review |

## How It Connects

Views query the [graph store](spec-graph-store) by provider/type. The [HUD](hud) layer toggles are a precursor. The [graph network](graph-network) receives filtered `KBGraph` data. The [overview view](overview-view) and [reading view](reading-view) gain view-aware navigation.

## Status

Blocked by [#42](https://github.com/anokye-labs/kbexplorer-template/issues/42) (graph store) and [#55](https://github.com/anokye-labs/kbexplorer-template/issues/55) (layer toggles). The [provider architecture spec](spec-providers-overview) places views in the "Run" phase. The [design decisions](design-decisions) node covers rationale.
