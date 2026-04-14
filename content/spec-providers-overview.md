---
id: "spec-providers-overview"
title: "Provider Architecture Spec"
emoji: "Diagram"
cluster: design
derived: true
connections: []
---

The provider architecture specification describes the evolution from kbexplorer's original monolithic content loading to a pluggable adapter system. Tracked in [#40](https://github.com/anokye-labs/kbexplorer-template/issues/40).

## Current Architecture

Three [providers](providers-overview) run today: [authored](authored-provider), [files](files-provider), and [work](work-provider). The [orchestrator](orchestrator) runs them in dependency order via the `ProviderRegistry`. Each returns `{ nodes, edges }` for the [graph engine](graph-engine).

## Evolution Path

1. **Crawl** — [node mapping](node-mapping) ([#41](https://github.com/anokye-labs/kbexplorer-template/issues/41)) + [graph store](spec-graph-store) ([#42](https://github.com/anokye-labs/kbexplorer-template/issues/42)) — done
2. **Walk** — GitHub/ADO provider ([#43](https://github.com/anokye-labs/kbexplorer-template/issues/43)) with depth limits
3. **Run** — [graph views](spec-views) ([#44](https://github.com/anokye-labs/kbexplorer-template/issues/44)) with named projections

## Provider Contract

```typescript
interface GraphProvider {
  id: string;
  name: string;
  dependencies?: string[];
  resolve(config: KBConfig, existingNodes: KBNode[]): Promise<ProviderResult>;
}
```

The `dependencies` array enables ordering. The `existingNodes` parameter enables cross-provider edges. The [identity system](identity) merges nodes across providers. The [design decisions](design-decisions) node explains why providers were chosen over a monolithic loader. The [content pipeline](content-pipeline) describes the overall data flow.
