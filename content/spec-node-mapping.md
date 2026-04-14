---
id: "spec-node-mapping"
title: "Node Mapping Spec"
emoji: "DocumentBulletList"
cluster: design
derived: true
connections: []
---

The node mapping specification defines how raw repository files become knowledge graph nodes via `nodemap.yaml`. Designed in [#41](https://github.com/anokye-labs/kbexplorer-template/issues/41) as part of the Graph Provider Architecture ([#40](https://github.com/anokye-labs/kbexplorer-template/issues/40)).

## The Schema

```yaml
- id: graph-engine
  title: Graph Engine
  file: src/engine/graph.ts
  emoji: Flash
  cluster: engine
  connections: imports    # derive from import statements
```

## Five Modes

The [node mapping](node-mapping) implementation supports: **file** (single file → single node), **split** (single file → parent + sections), **merge** (multiple files → single node), **glob** (pattern → one node per match), and **directory** (listing → tree node).

## Connection Derivation

The `connections` field supports: explicit arrays, `imports` (parse import/require statements), and `references` (scan for inline links).

## Identity Integration

The `file:` field creates identity links in the [multi-layer identity](multi-layer-identity) system. A nodemap entry with `file: src/engine/graph.ts` gets `urn:file:src/engine/graph.ts` as identity via the [identity system](identity), enabling merge with other representations.

## Implementation

Implemented in `src/engine/nodemap.ts` (commit `611e138`). The [local loader](local-loader) and [authored provider](authored-provider) consume `loadNodeMap()`. The [Content Derivation Engine (PR #76)](https://github.com/anokye-labs/kbexplorer-template/pull/76) uses nodemap entries to map source files to content targets.
