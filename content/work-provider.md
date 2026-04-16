---
id: "work-provider"
title: "Work Provider"
emoji: "TaskListSquareLtr"
cluster: data
derived: true
connections: []
---

The work provider (`src/engine/providers/work-provider.ts`) transforms GitHub issues, pull requests, and commits into graph nodes. These work items form the **work layer** — the living record of why the codebase looks the way it does, connecting decisions to implementations.

## Issues

Each GitHub issue becomes a `KBNode` via the [parser](parser)'s `issueToNode()`. The provider extracts `#N` cross-references from issue bodies using `extractIssueRefs()`, creating `cross_references` edges between related issues. Labels drive icon selection and visual badges, and issue state (open/closed) affects rendering in the [reading view](reading-view).

## Pull Requests

PRs get similar treatment — each becomes a node with connections to referenced issues. The PR body is rendered as markdown content via `marked`, and the merge state drives the node's visual appearance. PR nodes use `urn:pr:{number}` [identities](identity).

## Commits

Recent commits appear as lightweight nodes with `urn:commit:{sha}` identities. Commit messages are parsed for `#N` issue references, creating edges back to the issues they address.

```typescript
class WorkProvider implements GraphProvider {
  id = 'work';
  name = 'Work Items';
  dependencies: string[] = [];

  async resolve(_config, _existingNodes): Promise<ProviderResult> {
    // Convert issues via issueToNode()
    // Convert PRs to nodes with cross-references
    // Convert commits to lightweight nodes
    return { nodes, edges: [] };
  }
}
```

## Layer Model

Work nodes belong to the **Work layer** in the sense-making model ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)). The [HUD](hud) layer toggles ([#55](https://github.com/anokye-labs/kbexplorer-template/issues/55)) let users show or hide all work items at once — useful when the graph has many issues, revealing the structural and content layers beneath.

## Integration

The [local loader](local-loader) feeds issues, PRs, and commits from the manifest. In remote mode, the [GitHub API](github-api) fetches them at runtime. The [orchestrator](orchestrator) runs this [provider](providers-overview) with no dependencies. CI pipeline issues around GitHub token permissions ([PR #74](https://github.com/anokye-labs/kbexplorer-template/pull/74), [PR #75](https://github.com/anokye-labs/kbexplorer-template/pull/75)) taught us that missing `GH_TOKEN` silently produces an empty work layer — the [type system](type-system) can't detect missing data at the type level.
