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
  and `type` is just an advisory label. Two specifier forms load: a **local**
  relative path (`./` or `../`), and a **bare npm package** name (`pkg`,
  `@scope/pkg`, `pkg/subpath`) resolved from `node_modules`. Absolute paths and
  URL/scheme specifiers are rejected with a warning, so the loader never executes
  arbitrary remote code. A third-party package is additionally checked against the
  provider-API version + capabilities it declares and skipped (not crashed) if
  incompatible.
- `options` — free-form, passed straight through to your factory via
  `config.options`.
- `cluster` / `name` — surfaced on `config` for your factory to use.

## The render half (lenses)

A provider has two halves. The **data half** above (its `.` entry) depends only
on `@anokye-labs/kbexplorer-core` and stays pure ESM — no DOM, no React. The
optional **render half** ships the provider's **lenses**: the viewers and
block renderers that draw its typed nodes.

The render half is a separate module named by `views` on the data module (the
core `ProviderModule.views` specifier — e.g. `views: './views'`). It
default-exports a `ProviderViews` and types against the published render
contract, **`@anokye-labs/kbexplorer-view-kit`** — the one place `ViewerProps`,
`ViewerComponent`, `LazyViewer`, `BlockRenderer`, `BlockOutput`, `ProviderViews`,
and `VIEW_API_VERSION` are defined (React + Fluent are inherently UX-stack
specific, so this contract lives outside core):

```ts
import type { ProviderViews } from '@anokye-labs/kbexplorer-view-kit'

const views: ProviderViews = {
  viewers: { myType: ({ node }) => /* ... */ },
  blockRenderers: { myBlock: (block) => /* pure BlockOutput decision */ },
}
export default views
```

Two hard rules keep this clean:

- **Module-graph isolation.** Importing the `.` (data) entry MUST NOT evaluate
  the render module graph. The data entry stays pure ESM / core-only and never
  imports view-kit or React; data-only hosts (the CLI's Node ingest, the
  render-free engine) load it untouched. A render-capable host dynamic-imports
  the `./views` entry to mount the lenses. `views` is an **offer**, not a
  requirement: a dual-mode provider MUST NOT list the `'viewers'` capability.
- **Build only the views entry.** A **no-build provider** authors viewers with
  `React.createElement` (no JSX, no precompile). A **JSX provider** precompiles
  *only* its `./views` entry to ESM; the `.` data entry is left as pure
  ESM/core-only.

`npm install @anokye-labs/kbexplorer-view-kit` gives a provider compile-time
checking of its `./views` entry. Registry semantics are part of the contract:
viewer/renderer keys are **case-insensitive** and **last registration wins** (a
downstream provider can override a built-in). See the
[view-kit README](https://www.npmjs.com/package/@anokye-labs/kbexplorer-view-kit)
for the full surface and no-build / JSX authoring examples.

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
for a complete, runnable **local** provider, and
[`examples/quotes-provider/`](../examples/quotes-provider/) for the same contract
published as a **third-party npm package** (loaded by a bare specifier).
