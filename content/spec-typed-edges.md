---
id: "spec-typed-edges"
title: "Typed Directional Edges — Rich Link System"
emoji: "Flow"
cluster: design
connections: []
---

# Typed Directional Edges — Rich Link System

Typed edges are a prerequisite for meaningful [graph views](spec-views) in the
[provider system](spec-providers-overview). They classify edges produced by
[inline link extraction](spec-inline-link-extraction), and edge types vary by
[node mapping](spec-node-mapping) mode.

## Problem

Every edge in the graph is `{ from, to, description, weight? }`. There is no
edge type, no direction semantics, no source tracking. This means:

- A `derived_from` edge looks identical to a fuzzy "Mentions" edge
- Views can't filter by edge type (can't say "hide all inferred edges")
- The graph can't style different relationships differently
- Layout treats all edges equally — a weak mention has the same pull as containment
- When filtering edges at runtime, we can't determine which nodes lose all
  connections and should disappear from the view

## Core Model

### Edge Types

Each edge has a `type` that classifies the relationship:

| Type | Direction | Meaning | Default Strength | Source |
|------|-----------|---------|-----------------|--------|
| `contains` | parent → child | Structural containment (dir→file, parent→section) | 5.0 | inferred |
| `derived_from` | node → source file | Authored node ← its .md file | 3.0 | inferred |
| `imports` | file → dependency | Code import statement | 2.0 | inline |
| `references` | node → target | Explicit inline `[text](target)` link | 2.0 | inline |
| `frontmatter` | node → target | Declared in YAML frontmatter | 1.5 | frontmatter |
| `mentions` | node → target | Fuzzy title match in body text | 0.5 | inferred |
| `cross_references` | issue → issue | `#N` reference between issues | 1.5 | inline |
| `modifies` | commit → file | Git commit changed this file | 1.0 | inferred |
| `closes` | PR → issue | PR closes/fixes an issue | 2.0 | inferred |
| `related` | node ↔ node | Orphan linking (fallback) | 0.3 | inferred |

### Edge Source

Where the edge was derived from:

| Source | Meaning | Confidence |
|--------|---------|------------|
| `inline` | From a link in the content body (`[text](target)`, `import`, `#N`) | High |
| `frontmatter` | Declared in YAML frontmatter `connections:` | High (author-intentional) |
| `inferred` | System-derived (fuzzy matching, containment, structural) | Medium-Low |

### Directionality

Edges are directional. `from → to` carries semantic meaning:

- `A --contains--> B`: A is the parent/container
- `A --imports--> B`: A depends on B
- `A --references--> B`: A links to B
- `A --derived_from--> B`: A was generated from file B

The [graph network](graph-network) renders direction via arrow heads and
strength-based layout. The [node renderer](node-renderer) applies edge styling
per type using the table above.

### Strength and Layout

Edge strength (weight) influences vis-network physics:

- **Strong edges** (weight ≥ 3): tight clustering — parent/child, derived_from
- **Medium edges** (weight 1-3): moderate pull — imports, references
- **Weak edges** (weight < 1): loose — mentions, related

Strength is directional — a `contains` edge pulls the child toward the parent
more than vice versa.

## Extended Types

This model extends the `Connection` and `KBEdge` interfaces in the
[type system](type-system), changing edge building in the [graph engine](graph-engine).

```typescript
interface Connection {
  to: string;
  type: EdgeType;
  description: string;
  source: 'inline' | 'frontmatter' | 'inferred';
  weight?: number;         // override default for this edge type
  location?: {
    line?: number;
    section?: string;      // heading text of containing section
  };
}

type EdgeType =
  | 'contains'
  | 'derived_from'
  | 'imports'
  | 'references'
  | 'frontmatter'
  | 'mentions'
  | 'cross_references'
  | 'modifies'
  | 'closes'
  | 'related';

interface KBEdge {
  from: string;
  to: string;
  type: EdgeType;
  description: string;
  source: 'inline' | 'frontmatter' | 'inferred';
  weight: number;
  location?: { line?: number; section?: string };
}
```

## Runtime Filtering

The UI provides edge type toggles in the [HUD](hud):

```
Edge Filters:
  ☑ contains (structural)
  ☑ references (inline links)
  ☑ imports (code dependencies)
  ☑ frontmatter (declared)
  ☐ mentions (fuzzy matches)     ← hidden by default
  ☐ related (orphan links)       ← hidden by default
```

When an edge type is hidden:
1. All edges of that type are removed from the visible graph
2. Nodes that lose ALL connections as a result are removed from the view
3. The graph re-layouts with the reduced edge set

### Active Node Highlighting

When a node is focused:
- Its edges are highlighted (colored by type)
- Other edges are dimmed
- Edge type determines highlight style:
  - `contains`: solid thick line
  - `references`/`imports`: solid line with arrow
  - `frontmatter`: dashed line
  - `mentions`: dotted thin line
  - `related`: barely visible

## Edge Styling

| Type | Color | Style | Arrow |
|------|-------|-------|-------|
| `contains` | cluster color | solid thick | → |
| `derived_from` | muted gray | solid | → |
| `imports` | blue | solid | → |
| `references` | green | solid | → |
| `frontmatter` | amber | dashed | → |
| `mentions` | gray | dotted | none |
| `cross_references` | purple | solid | ↔ |
| `modifies` | orange | solid | → |
| `related` | faint gray | dotted | none |

## Implementation

### Phase 1: Type the existing edges

- Add `type` and `source` to `Connection` and `KBEdge`
- Update `parseMarkdownFile`: frontmatter connections get `type: 'frontmatter'`,
  inline links get `type: 'references'`, file path mentions get `type: 'references'`,
  derived_from gets `type: 'derived_from'`
- Update `buildEdges`: parent/child gets `type: 'contains'`
- Update `issueToNode`: cross-refs get `type: 'cross_references'`
- Default weights from the type table above

In the [reading view](reading-view), related nodes are grouped by edge type —
structural connections (contains, derived_from) are separated from reference
connections (imports, references) for clarity.

### Phase 2: Render edge types

- vis-network edge styling per type (color, dash, arrow)
- Active node highlighting with type-specific styles
- Canvas renderer updates for minimap

### Phase 3: Runtime filtering

- Edge type toggles in HUD
- Node removal when all edges hidden
- Re-layout on filter change

Tracked by [#49](issue-49).
