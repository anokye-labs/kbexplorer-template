# Authoring providers

A **provider** contributes nodes (and edges) to the knowledge graph. Beyond the
first-party built-ins, you can add your own by pointing config at a local
ES-module — **no core or engine code change required** (F5a).

## The contract

A provider module **default-exports a factory** wrapped in `defineProvider()`
from `@anokye-labs/kbexplorer-core`. The factory receives the provider's
`ExternalProviderConfig` entry and returns a `GraphProvider`:

```ts
import { defineProvider } from '@anokye-labs/kbexplorer-core'
import type { KBNode } from '@anokye-labs/kbexplorer-core'

export default defineProvider((config) => ({
  id: `my-provider-${config.name ?? 'default'}`,
  name: config.name ?? 'My Provider',
  // Optional: declare provider ids this one must run after.
  dependencies: [],
  // Resolve runs after dependencies; `existingNodes` are already-built nodes
  // you may cross-reference.
  async resolve({ existingNodes }) {
    const nodes: KBNode[] = [/* ... */]
    return { nodes, edges: [] }
  },
}))
```

The core `GraphProvider` contract is `resolve(context)` where `context` carries
`{ config, existingNodes }`. The template engine runs providers as
`resolve(config, existingNodes)`; the loader bridges the two automatically, so
author against the core contract above.

## Declaring it in `config.yaml`

Add an entry under `providers` with a `module` specifier. The specifier is
resolved relative to the loader (`src/engine/plugin-loader.ts`), so a repo-local
provider uses a path like `./providers/examples/glossary-provider`:

```yaml
providers:
  - type: glossary            # advisory label when `module` is set
    name: Glossary
    cluster: reference
    module: ./providers/examples/glossary-provider
    options:
      terms:
        - id: knowledge-graph
          term: Knowledge Graph
          definition: A graph of entities and their relationships.
          connections: [graph-engine]
```

- `module` — ES-module specifier. When present it takes precedence over `type`,
  and `type` is just an advisory label.
- `options` — free-form, passed straight through to your factory via
  `config.options`.
- `cluster` / `name` — surfaced on `config` for your factory to use.

## Ordering

Providers declare `dependencies` (other provider ids). The registry
topologically sorts them, so a provider that cross-references another's nodes can
rely on those nodes existing in `existingNodes` when its `resolve` runs.

## Loading behavior

- A module that can't be resolved, or whose default export isn't a factory, is
  **skipped with a warning** — it never aborts the build.
- An entry with a non-built-in `type` and **no** `module` is skipped with a
  warning (there's nothing to load).

## Example

See [`src/engine/providers/examples/glossary-provider.ts`](../src/engine/providers/examples/glossary-provider.ts)
for a complete, runnable local provider authored exactly the way a third-party
package would be (third-party npm provider packages land in F5b).
