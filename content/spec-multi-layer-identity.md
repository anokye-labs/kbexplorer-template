---
id: "spec-multi-layer-identity"
title: "Multi-Layer Node Identity"
emoji: "Layer"
cluster: design
connections: []
---

# Multi-Layer Node Identity

## Problem

In the current system, the same underlying entity can exist as multiple
unrelated nodes:

- `src/engine/graph.ts` exists as `file-src/engine/graph.ts` (from the file tree)
- The authored content `graph-engine` documents the same module
- Git commits that touch `graph.ts` reference it by path

These are three separate nodes with no explicit relationship. The [content pipeline](content-pipeline)
treats them as distinct entries — they live in different clusters, have different
connections, and don't know about each other.

When we add [graph views](spec-views), a user switching from "Code Structure"
to "Documentation" view should see the same entity — not lose context because
the node ID changed.

## The Core Insight

A file that is mapped to a content node in the authored layer is still a file
in the file layer. Whether both representations show up, or just one, or a
merged view — that's a decision the projection system makes per view.

This means:

1. **Nodes can share an identity** across [providers](spec-providers-overview)
2. **Each provider contributes its own representation** (content, metadata, connections)
3. **The view decides which representation to display** for a given identity
4. **Connections to any representation are connections to the identity**

## Solution: Identity URNs

Each node has an optional `identity` field in the [type system](type-system) — a canonical URN that links
representations across providers:

```typescript
interface GraphNode {
  id: string;           // unique within provider: 'file-src/engine/graph.ts'
  identity?: string;    // shared across providers: 'urn:file:src/engine/graph.ts'
  provider: string;
  // ... rest of node
}
```

### Identity Schemes

| Scheme | Format | Example |
|--------|--------|---------|
| File | `urn:file:{path}` | `urn:file:src/engine/graph.ts` |
| Issue | `urn:issue:{number}` | `urn:issue:42` |
| PR | `urn:pr:{number}` | `urn:pr:28` |
| Commit | `urn:commit:{sha}` | `urn:commit:abc1234` |
| Authored | `urn:content:{id}` | `urn:content:graph-engine` |

### How Identity Mapping Works

The [node map](spec-node-mapping) is where identities are declared:

```yaml
# nodemap.yaml
nodes:
  - id: graph-engine
    file: src/engine/graph.ts    # ← this creates the identity link
    title: "[Graph Engine](graph-engine)"
    cluster: engine
```

When `file: src/engine/graph.ts` is specified, the system creates identity
`urn:file:src/engine/graph.ts` and assigns it to both:
- The authored node `graph-engine`
- The file tree node `file-src/engine/graph.ts`

### View Projection with Identity

When the [overview view](overview-view) or [reading view](reading-view) renders, it resolves identities:

```
Code Structure view:
  Show file-src/engine/graph.ts representation
  (path, size, imports — from files provider)

Documentation view:
  Show graph-engine representation
  (authored content, diagrams — from authored provider)

Full Graph view:
  Merge into single node with combined connections
  (file metadata + authored content + commit history)
```

### Edge Routing Across Identities

When node A connects to `graph-engine` and node B connects to
`file-src/engine/graph.ts`, both edges effectively connect to the same entity.
The graph store resolves this:

- Edges stored with original `to` node ID
- Query layer resolves identity: "all edges to nodes with identity
  `urn:file:src/engine/graph.ts`" returns edges from both

### Impact on Graph Store Schema

The [graph store](spec-graph-store)'s `nodes` table gets an `identity` column:

```sql
ALTER TABLE nodes ADD COLUMN identity TEXT;
CREATE INDEX idx_nodes_identity ON nodes(identity);
```

Multiple nodes can share the same identity. The view projection layer
groups them and chooses which to display.

### Impact on Link Assessment

The [link assessment](spec-link-assessment) tool should:
- Detect when a file node and a content node clearly refer to the same entity
  but have no identity link (e.g., `graph-engine` content mentions
  `src/engine/graph.ts` repeatedly)
- Suggest identity mappings
- Flag conflicting identity claims (two content nodes both claim the same file)

## What This Enables

1. **Seamless view switching** — navigate to a node, switch view, stay on same entity
2. **Combined connections** — file's import graph + content's authored connections
   merge when viewing the full graph
3. **Progressive enrichment** — start with file nodes, add authored content later,
   they automatically merge via identity
4. **No duplication** — the graph doesn't show `graph.ts` AND `graph-engine` as
   separate nodes in the full view

Tracked by [#47](issue-47).
