---
id: "catalogue-transformer"
title: "Catalogue Transformer"
emoji: "ArrowRepeatAll"
cluster: infra
derived: true
connections: []
---

The catalogue transformer is the toolchain that converts the enriched catalogue (`content/catalogue-enriched.json`) into rendered content markdown files. It is part of the Content Derivation Engine ([PR #76](https://github.com/anokye-labs/kbexplorer-template/pull/76)) — infrastructure to derive kbexplorer content from systems of record instead of hand-authoring everything.

## Pipeline

```
catalogue.json → enrich-context.js → catalogue-enriched.json → derive-content.js → content/*.md
```

1. **Catalogue** — defines all nodes with IDs, titles, clusters, edge hints, and source file paths
2. **Enrichment** — `enrich-context.js` adds related issues, PRs, and recent commits from GitHub
3. **Derivation** — `derive-content.js` reads source files and enriched context to generate markdown
4. **Assessment** — `assess-graph.js` evaluates the resulting graph for quality

## Enriched Context

Each node gains:
- `relatedIssues` — issues referencing this component (number, title, snippet)
- `relatedPRs` — PRs that touched this component (number, title, snippet)
- `recentCommits` — commits that modified the file (sha, message)

This context enables content to explain **why** components were built, not just what they do.

## Integration

The transformer reads from the [content pipeline](content-pipeline)'s catalogue format and produces files consumed by the [graph engine](graph-engine). The [build scripts](build-scripts) orchestrate the flow. The [overview](overview) describes the full system architecture.
