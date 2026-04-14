---
id: "wiki-content-modes"
title: "Content Modes"
emoji: "DocumentMultiple"
cluster: guide
derived: true
connections: []
---

kbexplorer supports two content modes that determine where graph data comes from.

## Authored Mode

Content comes from markdown files with YAML frontmatter in `content/`. Each file becomes a node. The [authored provider](authored-provider) processes them via the [parser](parser).

```markdown
---
id: "my-component"
title: "My Component"
emoji: "Code"
cluster: engine
connections: []
---

Link to other nodes like [graph engine](graph-engine)
to create edges via [inline link extraction](inline-link-extraction).
```

## Repo-Aware Mode

Content comes from the [GitHub API](github-api) at runtime: issues → work nodes ([work provider](work-provider)), README → doc node, file tree → structural nodes ([files provider](files-provider)).

## Combining Modes

Both run simultaneously. The [KB loader](kb-loader) merges results via the [orchestrator](orchestrator) and [provider system](providers-overview). The [multi-layer identity](multi-layer-identity) system prevents duplicates.

## Local vs Remote

Orthogonal to content mode. The [local loader](local-loader) reads a manifest; the [GitHub API](github-api) fetches live data. Both serve either mode. See [Getting Started](wiki-getting-started).
