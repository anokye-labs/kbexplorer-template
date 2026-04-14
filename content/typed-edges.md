---
id: "typed-edges"
title: "Typed Edges Spec"
emoji: "BranchFork"
cluster: design
derived: true
connections: []
---

The typed edges specification defines the rich edge system that replaced kbexplorer's original simple `{ to, description }` connections. Designed in [#50](https://github.com/anokye-labs/kbexplorer-template/issues/50), this upgrade gives every edge a semantic type, direction, weight, and source provenance.

## Edge Type Taxonomy

| Type | Direction | Weight | Visual | Semantics |
|------|-----------|--------|--------|-----------|
| `contains` | parent → child | 3 | solid, thick | Structural containment |
| `references` | source → target | 1 | solid, thin | Explicit mention |
| `cross_references` | bidirectional | 0.8 | dashed | Issue/PR cross-reference |
| `implements` | spec → code | 1.2 | solid, arrow | Design → implementation |
| `related` | hub → orphan | 0.5 | dotted, faint | Rescue connection |

## Why Types Matter

Without edge types, the [graph engine](graph-engine) treats all connections equally — a folder containing a file looks the same as an issue referencing a component. Typed edges enable:

- **Visual differentiation** — the [graph network](graph-network) renders edges differently per type using `EDGE_TYPE_STYLES` from the [type system](type-system)
- **Layout physics** — higher weight creates shorter springs, pulling related nodes closer
- **Related panel ranking** — the [HUD](hud)'s related panel ([#52](https://github.com/anokye-labs/kbexplorer-template/issues/52)) weights by edge type
- **Filtering** — layer toggles can show/hide edges by type

## Source Provenance

Each edge tracks where it came from: `explicit` (frontmatter), `inferred` (inline links via [parser](parser)), `structural` (parent-child from [graph engine](graph-engine)), or `derived` (import analysis from [node mapping](node-mapping)). The [inline link extraction spec](inline-link-extraction) describes inferred edge discovery. The [design decisions](design-decisions) node explains the rationale.
