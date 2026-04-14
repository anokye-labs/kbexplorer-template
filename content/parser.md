---
id: "parser"
title: "Markdown Parser"
emoji: "DocumentText"
cluster: engine
derived: true
connections: []
---

The markdown parser (`src/engine/parser.ts`) is the text-processing backbone of kbexplorer. It transforms raw markdown files, GitHub issues, and repository trees into typed `KBNode` objects that the [graph engine](graph-engine) can assemble into a navigable knowledge graph. Every piece of content — whether hand-authored or fetched from the [GitHub API](github-api) — passes through this module. It was one of the four original core modules delivered in [PR #4](https://github.com/anokye-labs/kbexplorer-template/pull/4).

## Frontmatter Extraction

Authored markdown files use YAML frontmatter fenced by `---` delimiters. `parseFrontmatter()` splits the raw string with a regex, then `parseMarkdownFile()` maps the extracted fields (`id`, `title`, `emoji`, `cluster`, `connections`) onto a `KBNode` and renders the body with `marked`. The [identity system](identity) assigns a canonical URN to each parsed node via `assignIdentity()`.

```typescript
export function parseMarkdownFile(path: string, raw: string): KBNode {
  const { data, content } = parseFrontmatter(raw);
  const html = marked.parse(content, { async: false }) as string;
  // extract frontmatter connections, inline links, file refs
  node.identity = assignIdentity(node);
  return node;
}
```

## Inline Link Extraction

After frontmatter connections, the parser scans the markdown body for `[text](target)` links where the target is not an external URL, anchor, or image. Each match becomes a `references` edge with source `inline` — this is the mechanism defined in the [inline link extraction spec](inline-link-extraction). It then scans for bare file-path references (`src/…`, `scripts/…`) and adds those as `inferred` edges. Commit `941e9be` introduced file-path extraction, and `79fc1e0` extended it to README content. The clickable file paths feature ([#51](https://github.com/anokye-labs/kbexplorer-template/issues/51)) made these references interactive in the [reading view](reading-view).

## Issue-to-Node Conversion

`issueToNode()` converts a `GHIssue` into a `KBNode`, choosing an icon from a label-to-Fluent-icon map (e.g., `epic→Flag`, `bug→Bug`). It extracts `#N` cross-references from the body via `extractIssueRefs()`, creating `cross_references` edges. The [work provider](work-provider) calls this for each issue fetched from the API.

## Section Splitting

`splitIntoSections()` breaks a large markdown document at `##` headings into a parent node plus child section nodes. If fewer than two sections exist, it returns nothing (no split). Each section gets `parent: parentId` and the parent gets `contains` edges to all sections. The [node mapping](node-mapping) system uses this for the `split: true` mode.

## Tree-to-Node Conversion

`treeToNodes()` creates graph nodes from the GitHub file tree — repo root, directories, and key source files. The [files provider](files-provider) wraps this function. Combined with [node mapping](node-mapping) entries from `nodemap.yaml`, this builds the file layer of the [multi-layer identity](multi-layer-identity) system.

## Cluster Extraction

`extractClusters()` scans all nodes for unique cluster values and generates color assignments. Clusters defined in `config.yaml` get their specified colors; auto-generated clusters receive computed hues via HSL rotation. The [orchestrator](orchestrator) calls this after all providers have contributed their nodes, and the result feeds directly into the [graph engine](graph-engine).
