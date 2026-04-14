---
id: "authored-provider"
title: "Authored Provider"
emoji: "Compose"
cluster: data
derived: true
connections: []
---

The authored provider (`src/engine/providers/authored-provider.ts`) loads hand-written markdown content files and `nodemap.yaml` entries into the knowledge graph. It is the provider responsible for the curated, editorial layer of kbexplorer — the structured explanations, specs, and guides that give the graph its narrative backbone.

## How It Works

The provider implements `GraphProvider` from the [provider system](providers-overview) with two processing phases:

1. **Markdown parsing** — iterates over authored content files (passed as a `Record<string, string>` of path → raw markdown), calling the [parser](parser)'s `parseMarkdownFile()` for each
2. **Nodemap processing** — if `nodemap.yaml` raw content is provided, calls the [node mapping](node-mapping) system's `loadNodeMap()` to process file/glob/directory entries

```typescript
class AuthoredProvider implements GraphProvider {
  id = 'authored';
  name = 'Authored Content';
  dependencies: string[] = []; // runs independently

  async resolve(_config, _existingNodes): Promise<ProviderResult> {
    // Phase 1: parse markdown files → KBNode[]
    // Phase 2: process nodemap entries → KBNode[]
    return { nodes, edges: [] };
  }
}
```

## Identity Assignment

Every node gets an [identity](identity) URN. Markdown-parsed nodes receive `urn:content:{id}` via `parseMarkdownFile()`. Nodemap nodes with a `file:` source get `urn:file:{path}` via `assignIdentity()`. This dual scheme enables the [multi-layer identity](multi-layer-identity) system to link authored content to its source files.

## Error Handling

Failed parses are logged with `console.warn` and skipped — a single malformed markdown file won't crash the entire graph. This resilience was important during the graph store implementation ([#42](https://github.com/anokye-labs/kbexplorer-template/issues/42)) when the content directory was in flux.

## Integration

The [local loader](local-loader) creates an `AuthoredProvider` with content from the pre-built manifest. The [orchestrator](orchestrator) runs it alongside the [files provider](files-provider) and [work provider](work-provider). Its nodes form the content layer in the layer model defined by the sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)).
