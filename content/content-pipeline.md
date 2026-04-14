---
id: "content-pipeline"
title: "Content Pipeline"
emoji: "Pipeline"
cluster: data
derived: true
connections: []
---

The content pipeline is the conceptual flow that transforms raw content sources into the navigable knowledge graph. It is not a single file but a coordination pattern across the [orchestrator](orchestrator), [providers](providers-overview), [parser](parser), and [graph engine](graph-engine).

## Pipeline Stages

```
Sources → Providers → Parser → Nodes → Graph Engine → KBGraph → Views
```

1. **Sources** — GitHub API, local manifest, authored markdown, `nodemap.yaml`
2. **[Providers](providers-overview)** — [authored](authored-provider), [files](files-provider), [work](work-provider) adapters normalize sources into `KBNode[]`
3. **[Parser](parser)** — extracts frontmatter, inline links, cross-references
4. **[Graph Engine](graph-engine)** — computes edges, clusters, related nodes, degree maps
5. **Views** — [overview](overview-view), [reading](reading-view), graph render the final `KBGraph`

## Two Loading Modes

The pipeline runs in two modes controlled by the [KB loader](kb-loader):

- **Remote mode** — the [GitHub API](github-api) fetches live data; providers parse at runtime
- **Local mode** — the [local loader](local-loader) reads the pre-built manifest; same providers, zero network calls

Both produce identical `KBGraph` output. The Digital Twin Universe ([PR #66](https://github.com/anokye-labs/kbexplorer-template/pull/66)) adds a third testing mode with mock data.

## Edge Sources

Edges emerge from multiple points in the pipeline:
- Frontmatter `connections` arrays (explicit, from [parser](parser))
- Inline `[text](target)` links (inferred, via [inline link extraction](inline-link-extraction))
- `#N` issue cross-references (inferred, from [parser](parser))
- Import statements in source files (derived, from [node mapping](node-mapping))
- Parent-child containment (structural, from [graph engine](graph-engine))

The [typed edges spec](typed-edges) categorizes and weights these edge sources.

## Content Derivation

The Content Derivation Engine ([PR #76](https://github.com/anokye-labs/kbexplorer-template/pull/76)) introduced infrastructure to derive content from systems of record instead of hand-authoring everything. The [catalogue transformer](catalogue-transformer) orchestrates the derivation pipeline, and the [overview](overview) captures the current architecture state.
