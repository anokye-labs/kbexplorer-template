---
id: "multi-layer-identity"
title: "Multi-Layer Identity Spec"
emoji: "LayerDiagonal"
cluster: design
derived: true
connections: []
---

The multi-layer identity specification defines how the same real-world entity maintains a stable identity across multiple graph layers and [providers](providers-overview). Designed in [#47](https://github.com/anokye-labs/kbexplorer-template/issues/47) and implemented in commit `930f94c`, this system prevents duplicate nodes and enables cross-layer navigation.

## The Problem

A source file like `src/engine/graph.ts` can appear as: a **file node** from the [files provider](files-provider), a **content node** from the [authored provider](authored-provider) (as `graph-engine`), and a **concept** referenced in issues. Without identity, the [graph engine](graph-engine) treats these as separate nodes.

## URN Scheme

The [identity system](identity) assigns URN strings:

```
urn:file:src/engine/graph.ts   — file layer
urn:content:graph-engine        — content layer
urn:issue:42                    — work layer
urn:pr:76                       — work layer
urn:commit:930f94c              — work layer
```

## Identity Linking

The `file:` field in `nodemap.yaml` entries creates identity links between content nodes and source files. The [node mapping spec](spec-node-mapping) defines these mappings. `buildIdentityIndex()` groups nodes sharing a URN for merging.

## Layer Model

The sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)) formalized four layers: **File** (from [files provider](files-provider)), **Content** (from [authored provider](authored-provider)), **Work** (from [work provider](work-provider)), and **Concept** (inferred). Identity URNs bridge these layers. The [HUD](hud) layer toggles ([#55](https://github.com/anokye-labs/kbexplorer-template/issues/55)) show/hide entire layers. The [design decisions](design-decisions) node explains the URN rationale.
