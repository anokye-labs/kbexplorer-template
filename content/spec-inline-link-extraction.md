---
id: "spec-inline-link-extraction"
title: "Inline Link Extraction — Connections from Content"
emoji: "Link"
cluster: design
connections: []
---

# Inline Link Extraction — Connections from Content

## Problem

Connections in kbexplorer are currently declared in YAML frontmatter:

```yaml
connections:
  - to: graph-engine
    description: "feeds data to"
```

This is backwards. If the document body contains `[Graph Engine](graph-engine)`,
that's already a link — why redeclare it in frontmatter? Worse:

1. **Duplication** — the same relationship is stated twice (body + frontmatter)
2. **Staleness** — if the inline link is removed, the frontmatter connection persists
3. **Lost precision** — frontmatter connections are document-level; inline links
   carry section-level location
4. **Split breakage** — when a document splits into N nodes (1-to-N mapping),
   frontmatter connections float to the parent, but the inline link is in a
   specific section

## Core Principle

**Inline links ARE the graph edges.** The system should extract connections
from content automatically. Frontmatter connections are only for relationships
that have no inline expression in the body.

This changes how edges are produced in the [provider system](spec-providers-overview)
and populates edges directly into the [graph store](spec-graph-store).

## Link Types by File Format

Every file format has its own native link semantics. The system must extract
edges from each:

| Format | Link Mechanism | Example | Edge Type |
|--------|---------------|---------|-----------|
| Markdown | `[text](target)` | `[Graph Engine](graph-engine)` | `references` |
| Markdown | `#N` issue refs | `see #42` | `references` |
| Code (.ts/.js) | `import` statements | `import { buildGraph } from './graph'` | `imports` |
| Code (.ts/.js) | Dynamic imports | `await import('../generated/manifest.json')` | `imports` |
| HTML | `<a href="...">` | `<a href="graph-engine">` | `references` |
| File system | Directory containment | `src/engine/graph.ts` inside `src/engine/` | `contains` |
| Git | Commit touches file | commit `abc123` modifies `graph.ts` | `modifies` |
| YAML | References by key | `cluster: engine` | `belongs_to` |

## How Extraction Works

### Markdown Links

Scan the body for `[text](target)` patterns. If `target` matches a node ID
in the graph, create an edge:

```
Body contains: [Graph Engine](graph-engine)
→ Edge: { from: this-node, to: graph-engine, type: 'references',
          description: 'Graph Engine', location: { line: 42, section: 'Overview' } }
```

The edge carries **location** — which line and section it came from. This is
critical for 1-to-N splitting: when the document splits, the edge moves to
the section node that contains line 42, not the parent.

### Issue/PR References

Scan for `#N` patterns (excluding line number contexts like `#L42` or URLs):

```
Body contains: relates to #42
→ Edge: { from: this-node, to: issue-42, type: 'references',
          description: 'References #42', location: { line: 15 } }
```

### Code Import Extraction

For `.ts`/`.js` files mapped to nodes:

```typescript
import { buildGraph } from '../engine/graph';
→ Edge: { from: this-file-node, to: file-src/engine/graph.ts, type: 'imports' }
```

### Directory Containment

Already implicit in the file tree — `src/engine/graph.ts` is contained by
`src/engine/`. These edges exist today but aren't typed as `contains`.

## Edge Source: Inline vs Document-Level

Edges have a source type — extending the [type system](type-system) — indicating where they came from:

```typescript
interface GraphEdge {
  from: string;
  to: string;
  type: string;
  description: string;
  source: 'inline' | 'frontmatter' | 'inferred';
  location?: {
    line?: number;
    section?: string;  // heading text of containing section
  };
}
```

Inline links also create cross-identity edges when the same entity has
representations from multiple providers (see [multi-layer identity](spec-multi-layer-identity)).

| Source | Meaning | When to Use |
|--------|---------|------------|
| `inline` | Extracted from a link in the content body | Automatic — preferred |
| `frontmatter` | Declared in YAML frontmatter `connections:` | Only for abstract relationships not expressed in body |
| `inferred` | Derived by the system (title matching, import scanning) | Automatic — lower confidence |

## Impact on Frontmatter

Frontmatter `connections:` becomes **optional and supplementary**:

- **Don't duplicate inline links** — if the body has `[Graph Engine](graph-engine)`,
  no need for frontmatter connection to `graph-engine`
- **Use frontmatter for abstract relationships** — "this concept is part of that
  concept" where there's no inline mention
- **Frontmatter connections are document-level** — they belong to the node as a
  whole, not to a specific section

Over time, most connections should be inline. This also provides richer edge
data for [graph views](spec-views). Frontmatter connections indicate a
relationship that the author chose not to express in the prose.

## Impact on 1-to-N Splitting

When a document splits at `##` headings:

```markdown
## Overview
The [Graph Engine](graph-engine) computes edges...

## Data Flow
Data flows through the [Content Pipeline](content-pipeline)...
```

Splits into:
- **Parent node**: no inline connections (intro has none)
- **Section "Overview"**: edge to `graph-engine` (from line in this section)
- **Section "Data Flow"**: edge to `content-pipeline` (from line in this section)

This is why inline links are superior — they naturally partition when the
document is split per the [node mapping](spec-node-mapping) rules. Frontmatter connections
would all stay on the parent.

## Impact on Link Assessment

The `links` command ([link assessment](spec-link-assessment)) changes meaning:

- **"Missing cross-reference"** no longer means "body mentions but frontmatter doesn't declare."
  Instead it means "body mentions a concept but doesn't have an actual link to it."
- **Suggestion**: Instead of "add frontmatter connection", the tool should suggest
  "convert mention to inline link: change 'Graph Engine' to '[Graph Engine](graph-engine)'"
- **Frontmatter audit**: Flag frontmatter connections that duplicate inline links
  (these should be removed from frontmatter)

## Implementation

### Phase 1: Markdown Link Extraction

In `parser.ts`, after parsing markdown, scan for `[text](target)` and add
to connections alongside frontmatter connections. Deduplicate.

In the [reading view](reading-view), inline links become clickable graph navigation —
selecting a link navigates the graph to the target node.

### Phase 2: Issue Reference Extraction

Already partially exists (`extractIssueRefs`). Formalize as inline edges
with location tracking.

### Phase 3: Import Statement Extraction

For code files mapped via `nodemap.yaml`, scan for `import` statements
and create `imports` edges.

### Phase 4: Location Tracking

Add `location` to edges so they survive 1-to-N splitting correctly.

Tracked by [#48](issue-48).
