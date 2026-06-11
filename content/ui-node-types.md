---
id: "ui-node-types"
title: Node Types & Sources
emoji: DocumentBulletList
cluster: ui
connections:
  - to: node-types
    type: references
    description: The data-driven node-type registry
  - to: content-model-ingestion
    type: references
    description: Where typed (structured) entity nodes come from
  - to: structural-nodes
    type: references
    description: .github structural nodes and the skill type
  - to: type-system
    type: references
    description: Open NodeSource / DisplayMode unions
  - to: github-api
    type: references
    description: GitHub issues and PRs
  - to: content-pipeline
    type: references
    description: Authored content
  - to: wiki-knowledge-graph
    type: references
    description: External Wikipedia nodes
  - to: icon-gallery
    type: references
    description: Icon gallery display mode
---

Every node in kbexplorer comes from a **provider** — a system of record that feeds data into the knowledge graph. Each node carries a `source` (a [`NodeSource`](type-system) discriminated union) and a `display` mode; together they decide the badge shown beside the title and which view renders the body. Both are **open** unions (`KnownDisplayMode | (string & {})`), so new kinds of nodes slot in without editing the core types in `src/types/index.ts`.

## Source badges at a glance

The badge next to a node's title is driven by `NodeSource.type`:

| Badge | `NodeSource.type` | Provider |
| --- | --- | --- |
| Authored doc | `authored` | [content pipeline](content-pipeline) |
| GitHub issue | `issue` | [GitHub API](github-api) |
| Pull request | `pull_request` | [GitHub API](github-api) |
| Repository file | `file` | files / [structural](structural-nodes) |
| External article | `external` | Wikipedia & friends |
| Typed entity | `structured` | [content model](content-model-ingestion) + [structural](structural-nodes) |

The full union also covers `commit`, `readme`, `section`, `derived`, `branch`, `workflow`, and `repository` — see `src/types/index.ts`.

## GitHub issues

Issues show their state (🟢 open / 🟣 closed), labels, assignees, creation date, and a "View on GitHub ↗" link that opens the original issue in a new tab. Cross-references to other issues navigate within the graph.

## Pull requests

PRs display the same rich metadata — state, labels, dates, and an external link. References to issues in the PR body become graph connections.

## Authored content

Documentation nodes sourced from markdown files in the `content/` directory. These show the source filename in the badge and typically have the richest inline-linked prose — see the [content pipeline](content-pipeline) and the [authored provider](authored-provider).

## External references

Wikipedia articles and other external sources show the provider name (`source.type === 'external'`, with `provider` naming the plugin). Each includes an excerpt and a link to the original source.

## Icon gallery

A special display mode (`display: 'gallery'` / `'icon-detail'`) renders the Fluent icon library as a searchable, tiled grid — thousands of icon families browseable within the graph.

## Typed (structured) nodes and the viewer registry

Most "new" node types never add a bespoke `NodeSource` variant. Instead they reuse the open escape hatch:

```ts
{ type: 'structured'; entityType: string; ref?: string }
```

`entityType` is a key in the [node-type registry](node-types); `ref` optionally records the upstream record id the node was mapped from. On the rendering side, the matching escape hatch is `display: 'entity'` — the open `DisplayMode` value that routes a node to a **viewer resolved at runtime** rather than to a fixed layout.

### How a viewer is resolved

`src/views/ReadingView.tsx` switches on `display`; its `case 'entity'` calls `resolveViewer(node)` from `src/views/viewers/registry.ts`. The registry is a `Map<string, ViewerComponent>` keyed by `entityType` / JSON-LD `@type`, with these rules:

- **Resolution precedence** — `node.entityType` first, then JSON-LD `@type` (when `@type` is an array each entry is tried in order), then the [`GenericStructuredView`](node-renderer) fallback, so coverage is never zero.
- **Case-insensitive keys** — `registerViewer('Skill', …)` and a `@type` of `skill` resolve to the same entry.
- **Last registration wins** — re-registering a key replaces the prior viewer, letting downstream packages override built-ins without editing the core.

`registerViewer`, `hasViewer`, `getRegisteredViewers`, and `resetViewerRegistry` make up the rest of the seam. Because resolution falls back to a generic viewer, an unknown `@type` still renders as a structured card.

### Entity types with bespoke viewers

| `entityType` / `@type` | Viewer | Source |
| --- | --- | --- |
| `person` | `PersonView` | [content model](content-model-ingestion) |
| `squad` / `team` | `SquadView` | content model |
| `workstream` | `WorkstreamView` | content model |
| `mission` | `MissionView` | content model |
| `priority` | `PriorityView` | content model |
| `cycle` | `CycleView` | content model |
| `org` | `OrgView` | content model |
| `workflow` | `WorkflowView` | [structural](structural-nodes) |
| `github-action` | `ActionView` | structural |
| `skill` | `SkillView` | structural |
| `dependabot` · `funding` · `codeowners` · `templates` · `docs` | `GenericStructuredView` | structural |

The viewer registry keyed by `@type`, the `structured` source, and the `'entity'` display mode are the three open seams that let the [node-type engine](node-types) grow new types as pure data + a renderer — no edits to the core unions required.
