---
id: wiki-content-modes
title: "Content Modes"
emoji: "Document"
cluster: guide
parent: wiki-getting-started
connections:
  - to: content-pipeline
    description: "parsed by"
  - to: github-api
    description: "fetched via"
---

# Content Modes

kbexplorer supports two content modes that can run independently or **blended together** in a single graph.

## Repo-Aware (Default)

Zero-config exploration of any GitHub repository. The parser fetches:

- **Issues** — each becomes a node, clustered by first label. Cross-references (`#N`) create edges. Issues with 2+ headings split into parent + section nodes.
- **README** — single node connected to issues it mentions (keyword matching) and directories it references.
- **File tree** — repo root, directories (2 levels deep), and individual source files (`.ts`, `.tsx`, `.md`, `.json`, `.yaml`, `.css`). Each file is parented to its containing directory.

PRs and commits are not included — the GitHub API doesn't provide reliable associations without per-PR API calls that would exhaust the rate limit.

## Authored

Markdown files with YAML frontmatter in a `content/` directory. Full control over node metadata, connections, and clusters:

```yaml
---
id: my-concept
title: "My Concept"
emoji: "Sparkle"
cluster: architecture
connections:
  - to: other-concept
    description: "depends on"
---
```

## Blended Mode

When `source.path` is set in config AND the repo has issues/files, kbexplorer loads **both** — repo-aware nodes and authored nodes merge into a single graph. Authored docs can link to repo file nodes (e.g., `to: file-src/engine/graph.ts`), creating cross-layer edges between documentation and code.
