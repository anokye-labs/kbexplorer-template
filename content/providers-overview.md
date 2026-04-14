---
id: "providers-overview"
title: "Content Providers"
emoji: "PlugConnected"
cluster: data
derived: true
connections: []
---

The provider system (`src/engine/providers.ts`) defines the plugin architecture for content sources in kbexplorer. Each provider is a self-contained adapter that knows how to fetch content from one source — authored markdown, file trees, or work items — and produce `KBNode[]` arrays that the [orchestrator](orchestrator) assembles into a unified graph.

## The Provider Interface

Every provider implements the `GraphProvider` interface:

```typescript
interface GraphProvider {
  id: string;
  name: string;
  dependencies?: string[];
  resolve(config: KBConfig, existingNodes: KBNode[]): Promise<ProviderResult>;
}

interface ProviderResult {
  nodes: KBNode[];
  edges: KBEdge[];
}
```

The `dependencies` array declares which other providers must run first. The `existingNodes` parameter gives each provider access to previously collected nodes — enabling cross-provider edge creation.

## The Provider Registry

The `ProviderRegistry` class manages registration and execution ordering via depth-first topological sort:

- `register(provider)` — adds a provider
- `getExecutionOrder()` — returns providers in dependency-safe order
- `get(id)` — retrieves a provider by ID

This pattern was designed for extensibility. The [Graph Provider Architecture (#40)](https://github.com/anokye-labs/kbexplorer-template/issues/40) tracks the evolution, and [#42](https://github.com/anokye-labs/kbexplorer-template/issues/42) implemented the first provider interface alongside the graph store.

## Current Providers

| Provider | Source | What it produces |
|----------|--------|-----------------|
| [Authored Provider](authored-provider) | Markdown files + nodemap | Content nodes with frontmatter |
| [Files Provider](files-provider) | GitHub file tree | Directory and source file nodes |
| [Work Provider](work-provider) | GitHub issues/PRs/commits | Work item nodes |

## Future Providers

The planned GitHub/ADO provider ([#43](https://github.com/anokye-labs/kbexplorer-template/issues/43)) will add on-demand PR expansion with depth limits. The sense-making epic ([#54](https://github.com/anokye-labs/kbexplorer-template/issues/54)) laid groundwork for layer-based filtering that works with the provider model.

## Integration

The [local loader](local-loader) creates providers from the pre-built manifest and registers them. The [orchestrator](orchestrator) runs `getExecutionOrder()` and executes each sequentially. The [identity system](identity) ensures nodes from different providers with the same real-world referent get merged correctly. All provider types are defined in the [type system](type-system).
