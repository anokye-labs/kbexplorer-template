---
id: "orchestrator"
title: "Orchestrator"
emoji: "ArrowSync"
cluster: engine
derived: true
connections: []
---

The orchestrator (`src/engine/orchestrator.ts`) is the central coordination point that runs [content providers](providers-overview) in dependency order, collects their nodes, and feeds them to the [graph engine](graph-engine) to produce the final `KBGraph`. It exists because providers may depend on each other — for example, the future GitHub/ADO provider ([#43](https://github.com/anokye-labs/kbexplorer-template/issues/43)) needs the graph store from [#42](https://github.com/anokye-labs/kbexplorer-template/issues/42).

## Pipeline

The orchestration pipeline is compact — just four steps — but strict in ordering:

1. **Topological sort** — the [provider registry](providers-overview) resolves dependencies via `getExecutionOrder()` and returns providers in safe execution order
2. **Sequential execution** — each provider's `resolve()` is called in order, receiving `config` and all previously collected nodes so later providers can reference earlier output
3. **Cluster extraction** — the [parser](parser)'s `extractClusters()` derives `Cluster[]` from the accumulated node set and `config.yaml` colors
4. **Graph build** — the [graph engine](graph-engine)'s `buildGraph()` computes edges, related nodes, and degree maps

```typescript
export async function orchestrate(
  registry: ProviderRegistry,
  config: KBConfig,
): Promise<KBGraph> {
  const allNodes = await collectProviderNodes(registry, config);
  const clusters = extractClusters(allNodes, config);
  return buildGraph(allNodes, clusters);
}
```

## Two Entry Points

The module exports two functions for different use cases:

- **`collectProviderNodes()`** — lower-level, returns only the `KBNode[]` array. Use this when you need to transform or filter nodes before graph building
- **`orchestrate()`** — higher-level, returns the complete `KBGraph`. This is the standard entry point used by the [KB loader](kb-loader) and [local loader](local-loader)

## Provider Dependency Resolution

The [provider registry](providers-overview) uses depth-first topological sort to determine execution order. Currently the [authored provider](authored-provider), [files provider](files-provider), and [work provider](work-provider) all declare empty `dependencies` arrays, but the architecture supports arbitrary chains for future providers.

## Content Pipeline Integration

The orchestrator sits between the [content pipeline](content-pipeline) (which defines how content flows) and the [type system](type-system) (which defines the shapes). The [local loader](local-loader) builds a provider registry from the pre-built manifest and calls `orchestrate()` exactly once during startup. In remote mode, the [KB loader hook](kb-loader) constructs providers from live API responses and follows the same path.
