---
id: "wiki-data-pipeline"
title: "Data Pipeline Guide"
emoji: "Flow"
cluster: guide
derived: true
connections: []
---

How content flows from sources to rendered views — the [content pipeline](content-pipeline) from a user perspective.

## The Flow

```
Markdown → Parser → Providers → Orchestrator → Graph Engine → Views
```

## Step 1: Author Content

Create markdown in `content/` with YAML frontmatter. Use `[text](node-id)` links to create edges — [inline link extraction](inline-link-extraction) handles the rest.

## Step 2: Map Source Files

Add entries to `nodemap.yaml`. The [node mapping](node-mapping) system supports five modes. The [Node Mapping Spec](spec-node-mapping) has the schema.

## Step 3: Generate Manifest

```bash
npm run prebuild
```

The [build scripts](build-scripts) capture everything the [local loader](local-loader) needs.

## Step 4: Inspect the Graph

```bash
node scripts/assess-graph.js
```

Evaluates connectivity (4-8 links/node target), cluster balance, orphans, and hub reachability.

## Providers

| Provider | Input | Output |
|----------|-------|--------|
| [Authored](authored-provider) | Markdown + nodemap | Content nodes |
| [Files](files-provider) | File tree | Directory/file nodes |
| [Work](work-provider) | Issues/PRs/commits | Work nodes |

## Troubleshooting

- **Broken links** — check target node IDs exist; the [parser](parser) drops invalid links
- **Missing edges** — use `[text](node-id)` format, not full URLs
- **Stale graph** — re-run `npm run prebuild` and restart [Vite](vite-config)
