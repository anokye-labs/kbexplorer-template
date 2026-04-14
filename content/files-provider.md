---
id: "files-provider"
title: "Files Provider"
emoji: "DocumentCopy"
cluster: data
derived: true
connections: []
---

The files provider (`src/engine/providers/files-provider.ts`) produces file-tree nodes — the repository root, directories, and key source files — from the GitHub tree API response. These nodes form the **file layer** of the knowledge graph, giving users a structural view of the codebase alongside the editorial content layer.

## How It Works

The provider wraps the [parser](parser)'s `treeToNodes()` function inside the `GraphProvider` interface from the [provider system](providers-overview):

```typescript
class FilesProvider implements GraphProvider {
  id = 'files';
  name = 'File System';
  dependencies: string[] = [];

  async resolve(_config, _existingNodes): Promise<ProviderResult> {
    const nodes = treeToNodes(this.treeItems, this.repoName, this.excludePaths);
    // Assign urn:file: identity to each node
    return { nodes, edges: [] };
  }
}
```

Each tree item becomes a `KBNode` with `contains` connections to its children. Directories get folder icons; source files get language-appropriate icons. The `excludePaths` parameter filters out noise like `node_modules/` and `.git/`.

## Identity

Every file node receives a `urn:file:{path}` [identity](identity) via `assignIdentity()`. This enables the [multi-layer identity](multi-layer-identity) system to link file nodes to their corresponding authored content nodes — for example, `urn:file:src/engine/graph.ts` links to the `graph-engine` content node.

## Layer Model

In the layer model from the sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)), file nodes belong to the **File layer**. The layer toggles ([#55](https://github.com/anokye-labs/kbexplorer-template/issues/55)) in the [HUD](hud) allow showing/hiding this entire layer. The graph store ([#42](https://github.com/anokye-labs/kbexplorer-template/issues/42)) makes this separation possible.

## Integration

The [local loader](local-loader) creates a `FilesProvider` from the manifest's tree data. The [GitHub API](github-api) provides the tree in remote mode. The [orchestrator](orchestrator) runs this provider with no dependencies alongside the [authored provider](authored-provider) and [work provider](work-provider).
