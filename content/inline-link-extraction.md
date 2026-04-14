---
id: "inline-link-extraction"
title: "Inline Link Extraction"
emoji: "Link"
cluster: design
derived: true
connections: []
---

The inline link extraction specification defines the principle that **inline links ARE the graph edges**. Rather than requiring authors to maintain a separate `connections` array in frontmatter, the system extracts edges directly from the markdown content — every `[text](target)` link that resolves to a known node ID becomes an edge.

## Core Principle

A markdown link `[Graph Engine](graph-engine)` does double duty:
1. It renders as a clickable link in the [reading view](reading-view)
2. It creates a `references` edge in the [graph engine](graph-engine) with source `inferred`

This was designed in [#48](https://github.com/anokye-labs/kbexplorer-template/issues/48) and implemented in commit `472396c`.

## How Extraction Works

The [parser](parser)'s `parseMarkdownFile()` scans the body for inline links, filtering out external URLs (`http`), anchors (`#`), and image paths (`.png`, `.jpg`). Remaining targets are matched against known node IDs. Commit `941e9be` added file-path reference extraction, and `79fc1e0` extended it to README content.

```typescript
// Links extracted from markdown body
[Graph Engine](graph-engine)     → edge to graph-engine
[src/types](type-system)         → edge to type-system
```

## Why This Matters

Without inline link extraction, content authors would maintain both prose links and frontmatter connection arrays — a duplication that always drifts out of sync. By deriving edges from content, the graph stays accurate as long as the prose is accurate. The [typed edges spec](typed-edges) categorizes these as `references` type with `inferred` source.

## Clickable File References

Issue [#51](https://github.com/anokye-labs/kbexplorer-template/issues/51) extended this to file path references — when content mentions `src/engine/parser.ts`, the edge exists in graph data, but originally rendered as a plain `<code>` tag. The fix made paths clickable in the [reading view](reading-view).

## Integration

The extraction runs during parsing in the [parser](parser), feeding edges to the [graph engine](graph-engine). The [design decisions](design-decisions) and [content pipeline](content-pipeline) nodes cover the broader context.
