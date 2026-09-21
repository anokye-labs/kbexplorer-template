# SUBSYSTEMS — current data flow

> **Status:** descriptive of the codebase **after** the Epic #298 decoupling
> (Phases 0–6, all merged). It documents the stabilized **four-layer pipeline**
> — **Sources → Providers → Engine (pure `KBGraph`) → Representation** — backed
> by the shared `@anokye-labs/kbexplorer-core` contracts package. For the
> historical Phase-0 inventory (the two "fat loaders" and out-of-provider
> post-processing this refactor removed), see the file history of this doc.

## Template ownership: presentation layer, not graph logic

This repository is intentionally a thin **presentation/template layer**. The real
knowledge-base graph logic is not authored here; it is consumed from
`@anokye-labs/kbexplorer-engine` and invoked through the `kbx` CLI, as declared
in `AGENTS.md` and the scripts in `package.json`.

The repository boundary is explicit:

- `src/engine/local-loader.ts` and `src/engine/remote-loader.ts` are adapters that
  choose a source and call the shared engine entrypoint.
- `src/engine/loader.ts` is the single assembly path that calls
  `loadKnowledgeBase(source, config)`.
- `src/types/index.ts` re-exports the pure `KBGraph` / `KBConfig` contracts from
  `@anokye-labs/kbexplorer-core` so the UI and representations can consume a
  stable, engine-free data shape.
- `src/representation/targets/*` and `src/views/*` render the graph; they do not
  regenerate or mutate upstream graph-domain logic.

The repo owns the runtime UI shell, content-mode adapters, registration seams,
visualization glue, and customization hooks. It does not own the authoritative
provider/transform/manifest algorithms.

## Actual runtime/UI layers

The runtime composition starts in `src/App.tsx`:

- `Explorer` calls `useKnowledgeBase()` from `src/hooks/useKnowledgeBase.ts`.
- `useKnowledgeBase()` detects local mode with `detectLocalMode()` and then loads
  either `loadLocalKnowledgeBase()` or `loadRemoteKnowledgeBase()`.
- After the graph is ready, the app resolves the selected representation target
  from `representationRegistry` and renders it.

This flow is intentionally split by responsibility:

1. `src/knowledge-base.ts` — environment-aware orchestration for loading and
   applying external theme overrides.
2. `src/engine/local-loader.ts` — local snapshot path using a pre-built manifest.
3. `src/engine/remote-loader.ts` — live GitHub API path using `GitHubApiSource`.
4. `src/representation/targets/spa.tsx` — route tree for the browser explorer.
5. `src/views/*` — concrete screens (overview, reading, HUD, search, graph panel).
6. `src/representation/graph-canvas/createGraphNetwork.ts` — vis-network graph
   construction and deterministic layout.

`App.tsx` renders the selected target through the representation registry:

```ts
const spaView = representationRegistry
  .resolve<ReactNode>('spa')
  .render(graph, { config, fluentTheme, landingPath }) as ReactNode;
```

The render boundary is therefore `KBGraph + KBConfig + render options`, not raw
source objects or engine internals.

## Environment-specific adapters

The repo has two concrete source adapters that both converge on the same engine
input contract:

| Adapter | Entry point | Source | Intent |
|---|---|---|---|
| Local | `src/engine/local-loader.ts` | `ManifestSource` | zero-API manifest mode (`VITE_KB_LOCAL === 'true'`) |
| Remote | `src/engine/remote-loader.ts` | `GitHubApiSource` | live GitHub API path |

`loadLocalKnowledgeBase()` and `loadRemoteKnowledgeBase()` both return the same
shape:

```ts
{ graph: KBGraph; config: KBConfig; themeFileRaw: string | null }
```

`src/knowledge-base.ts` then applies `themeFileRaw` via
`applyExternalTheme(...)`, so the final config is a merged runtime config, not a
new graph pipeline.

## Graph visualization and viewer registration

This repository owns the graph visualization layer while the graph content itself
comes from the engine.

### Representation targets

`src/representation/targets/index.ts` pre-registers the built-ins:

- `spa` → `src/representation/targets/spa.tsx`
- `json-ld` → `src/representation/targets/json-ld.ts`
- `llm-context` → `src/representation/targets/llm-context.ts`
- `copilot` → `src/representation/targets/copilot.tsx`

The registry is a simple `Map<string, Representation<unknown>>` in
`src/representation/registry.ts`.

### Viewer registry

`src/views/viewers/registry.ts` maintains the separate `entityType` → viewer map.
It resolves by `entityType`, JSON-LD `@type`, and falls back to
`GenericStructuredView`.

`registerViewers()` in `src/views/viewers/registerViewers.ts` is the composition
hook used by both app entrypoints (`src/main.tsx` and `src/canvas.tsx`). The code
explicitly preserves last-registration-wins precedence so provider-specific
viewer registrations can override built-ins after the built-in pass.

Built-ins are registered in `src/views/viewers/builtin-map.ts`:

- `workflow`, `action`, `github-action`, `skill`, `person`, `squad`, ...
- `team`, `service`, `decision`, `system-of-record`, and related node classes.

That is the safe seam for new typed renderers: register a viewer by entity type,
not by editing the graph engine.

```mermaid
flowchart LR
  A[App.tsx] --> B[useKnowledgeBase]
  B --> C{local mode?}
  C -->|yes| D[loadLocalKnowledgeBase]
  C -->|no| E[loadRemoteKnowledgeBase]
  D --> F[ManifestSource / KBGraph]
  E --> G[GitHubApiSource / KBGraph]
  F --> H[representationRegistry.resolve('spa')]
  G --> H
  H --> I[renderSpaRoutes]
  I --> J[OverviewView / ReadingView / GraphView]
  J --> K[vis-network canvas]
```

```mermaid
flowchart TD
  A[registerViewers()] --> B[registerBuiltinViewers()]
  B --> C[registerViewer('person', PersonView)]
  B --> D[registerViewer('team', TeamView)]
  A --> E[provider contributions]
  E --> F[registerViewer(type, Component)]
  F --> G[registry.set(key, viewer)]
  G --> H[resolveViewer(node)]
  H --> I[GenericStructuredView fallback]
```

## Consumed engine/core/provider/search/CLI contracts

The repo is intentionally narrow in what it consumes from the upstream stack.

### Engine contract

The engine entrypoint is `loadKnowledgeBase(source, config)` in
`src/engine/loader.ts`. The code in the template never reimplements the graph
assembly; it passes the chosen source + config into the upstream engine and
expects a compatible `KBGraph`.

### Core contracts

`src/types/index.ts` re-exports the core data contract from
`@anokye-labs/kbexplorer-core` and keeps the template free of engine runtime
imports. The data boundary includes:

- `KBNode`, `KBEdge`, `KBGraph`, `KBConfig`
- `SourceConfig`, `Theme`, `Cluster`, `Connection`
- schema helpers such as `buildJsonLd`, edge type style helpers, and access-label
  utilities

This is the rendering boundary for all `Representation` implementations.

### Provider contract

The provider pattern is used by the upstream engine, not re-created here. The
template is designed to work with providers that expose `GraphProvider` behavior
and are registered by the engine when the repo data is assembled. The provider
loading seam is visible in the rule comments in `src/engine/local-loader.ts` and
`src/engine/remote-loader.ts`, and in the cross-layer docs in `AGENTS.md`.

### Search contract

The repository’s local search layer is deliberately template-owned, not engine-owned.
`src/search/index.ts` builds a hand-rolled inverted index over `KBNode[]` with:

- `tokenize()` and `stripMarkdown()`
- `extractHeadings()`
- `buildSearchIndex()`
- `searchIndex()`

`src/search/useSearchIndex.ts` memoizes the index and keeps the app from
re-indexing on every keystroke. Search only runs over the built graph and
explicitly excludes withheld nodes using `isAccessWithheld()`.

### CLI contract

The CLI relationship is made explicit by `package.json`:

- `prebuild`: `kbx manifest`
- `validate`: `kbx graph validate`
- `validate:drift`: `kbx manifest --check`
- `assess`: `kbx graph assess`
- `derive`: `kbx graph derive`
- `compare`: `kbx graph compare`

This repo has no custom graph-domain implementation under `src/engine/*`; it
uses the upstream CLI and engine as its data production layer.

## Data representation at the rendering boundary

The rendering boundary is deliberately minimal and pure.

- `src/types/index.ts` exposes the `KBGraph` contract that representations
  consume.
- `src/representation/targets/spa.tsx` receives `graph`, `config`, and
  `fluentTheme` and returns React routes.
- The graph canvas path is created by
  `src/representation/graph-canvas/createGraphNetwork.ts`.
- `src/views/viewers/registry.ts` resolves a viewer for each node based on the
  node’s `entityType` or JSON-LD `@type`.

The important contract is: the template does not hand a renderer a live source,
raw GitHub payload, or engine context object. It hands the renderer the final
`KBGraph` and config metadata needed to display it.

## Safe extension points

The template’s extension seams are intentionally narrow and stable:

1. Add or alter a source adapter in `src/engine/local-loader.ts` or
   `src/engine/remote-loader.ts`.
2. Register a new representation target in `src/representation/targets/index.ts`.
3. Register a new viewer in `src/views/viewers/registerViewers.ts` or `registerViewer()`.
4. Add UI behavior in `src/App.tsx`, `src/hooks/*`, or `src/components/*` without
   changing the graph engine contract.
5. Replace or extend search logic in `src/search/*` without touching upstream core
   graph generation.

Do not edit the upstream graph assembly logic in the engine package when the
requirement is only a template-side view, renderer, or provider adapter. The
repo’s safe extension model is registration and composition, not replacing the
engine’s algorithms.

## Summary

The template is best understood as a **thin runtime shell over a shared engine**:

- runtime/UI shell: `src/App.tsx`, `src/hooks/*`, `src/components/*`, `src/views/*`
- visualization and route rendering: `src/representation/*`
- environment adapters: `src/engine/local-loader.ts`, `src/engine/remote-loader.ts`
- pure data boundary: `src/types/index.ts`
- search/view layer: `src/search/*`, `src/views/viewers/*`
- authoritative graph logic: `@anokye-labs/kbexplorer-engine` + `kbx` CLI

This keeps the template focused on composition, rendering, and customization
while the engine remains the source of truth for graph semantics and graph
creation.

## Pipeline at a glance

```
   system of record            ┌──────────────── ENGINE ────────────────┐
   (manifest / GitHub API)      │  loadKnowledgeBase(source, config)      │
        │                       │   • source.getRepoData()  → RepoData    │
        ▼                       │   • registerProviders(registry, data)   │
  ┌───────────────┐  RepoData   │   • + external providers (config.providers)
  │    SOURCE      │ ──────────▶ │   • orchestrateWithTransforms(...)      │
  │ Manifest /     │            │       – collectProviderNodes (ordered)  │
  │ GitHubApi      │            │       – applyTransforms (ordered stage)  │
  │ (RepoSource)   │            │       – extractClusters                  │
  └───────────────┘            │       – buildGraph  → KBGraph            │
                                └───────────────────┬─────────────────────┘
                                                    │  pure KBGraph
                                                    ▼
                                       ┌──────── REPRESENTATION ────────┐
                                       │  RepresentationRegistry         │
                                       │   spa · json-ld · llm-context   │
                                       └─────────────────────────────────┘
```

Both runtime entry points are now **thin wrappers** over the single engine
entrypoint; they differ only in which `Source` they construct:

| Mode | Entry point | Source |
|------|-------------|--------|
| local (`VITE_KB_LOCAL=true`) | `loadLocalKnowledgeBase()` in `src/engine/local-loader.ts` | `ManifestSource` over the pre-built `src/generated/repo-manifest.json` |
| remote (default) | `loadRemoteKnowledgeBase()` in `src/engine/remote-loader.ts` | `GitHubApiSource` over the live GitHub API |

Both call `loadKnowledgeBase(source, config)` (`src/engine/loader.ts`) and emit
the identical `KBGraph` shape (re-exported from core via `src/types/index.ts`).

## Shared contracts — `@anokye-labs/kbexplorer-core` (Phase 1)

The pure cross-layer contracts live in the separate package and are re-exported
from `src/types/index.ts` for back-compat:

- graph + config: `KBNode`, `KBEdge`, `KBGraph`, `KBConfig`, identity/URN helpers,
  relation taxonomy, JSON-LD helpers (`buildJsonLd`);
- the layer interfaces: `Source` / `Resource` / `Affordance` / `Link`,
  `GraphProvider`, `Representation`.

> **Two URN schemes — don't conflate them.** Engine **node identity** is a `urn:*`
> URN (e.g. `urn:file:<path>`), minted by `assignIdentity` (`src/engine/identity.ts`).
> The navigable **`kg://`** scheme is a *representation* concern — the inter-node
> hyperlinks the `json-ld` / `llm-context` targets emit (e.g. `kg://node/<id>`).

`src/types/index.ts` imports **nothing from the engine at load** — enforced by
`src/types/__tests__/no-engine-import.test.ts` (Phase 2) — so the data types can
be consumed as pure data by every representation target.

## Layer 1 — Sources — `src/engine/sources/**`

A **`RepoSource`** (`src/engine/sources/repo-data.ts`) both implements the pure
`Source` contract from core and exposes the engine-facing
`getRepoData(): Promise<RepoData>`. `RepoData` is the normalized superset both
acquisition paths produce, so the loader wires providers once.

| Source | File | Affordances |
|--------|------|-------------|
| `ManifestSource` | `src/engine/sources/manifest-source.ts` | every resource `['read']` only — a frozen snapshot has no staging area |
| `GitHubApiSource` | `src/engine/sources/github-api-source.ts` | composite **Git ≠ GitHub** families; **per-retrieval** affordances |

**Per-retrieval situational affordances (§4A).** A source declares a *possible*
universe (`possibleAffordances`), but each retrieved `Resource` carries the
affordances allowed *now* plus hypermedia `links`. The same git file comes back
`['read']` from a plain read and `['read','write','stage']` against a writable
worktree; once staged it additionally carries a first-class
`{ rel: STAGING_AREA_REL, href }` link to the retrievable staging area. **Git ≠
GitHub:** `GitHubApiSource` exposes Git resources (`file`/`tree`/`commit`/
`staging-area`, addressed `git://`) separately from GitHub resources
(`issue`/`pull-request`/`release`, addressed `github://`); PR `merge`/`comment`
never leak onto git resources. Contract tests: `src/engine/__tests__/sources.test.ts`.

## Layer 2 — Providers — `src/engine/providers/**`, `src/engine/providers.ts`

Each provider implements `GraphProvider { id, name, dependencies?, resolve() }`
and returns `{ nodes, edges }`. `ProviderRegistry` (`src/engine/providers.ts`)
topologically sorts by each provider's `dependencies`, so a provider can read
earlier providers' output via `existingNodes`.

Built-ins wired by `registerProviders()` (`src/engine/loader.ts`), conditional on
what the `RepoData` bundle actually carries (absent inputs → safe no-op):

| Provider | Emits |
|----------|-------|
| `FilesProvider` | directory / `tree` nodes (`urn:file:<path>`) |
| `AuthoredProvider` | authored-markdown nodes (+ nodemap) |
| `WorkProvider` | issues, PRs, commits, releases, repo-root |
| `PersonProvider` | people derived from GitHub activity |
| `StructuralProvider` | repository node from `.github/**` |
| `ContentModelProvider` | content-model spine (no-op if absent) |

**Pluggable providers (Phase 5).** External providers declared under
`config.providers` are loaded by `src/engine/plugin-loader.ts`:

- **local ES module (F5a)** — a relative `module: ./...` specifier is dynamic
  imported and its `defineProvider()` default export instantiated. No core/engine
  change required.
- **3rd-party npm (F5b)** — a **bare** specifier (`pkg`, `@scope/pkg`,
  `pkg/subpath`) resolves from `node_modules`; absolute/URL specifiers are
  **rejected** (no remote code execution). Third-party modules are guarded by
  `checkProviderCompatibility()` (provider-API version + declared capabilities)
  and **skipped with a clear reason** if incompatible, never crashing the build.

The built-in `WikipediaProvider` / `OrgChartProvider` remain resolvable by `type`.
Examples: `src/engine/providers/examples/glossary-provider.ts` (local),
`examples/quotes-provider/` (npm). Author guide: [`providers.md`](./providers.md).

## Layer 3 — Engine — `src/engine/loader.ts`, `orchestrator.ts`, `transforms.ts`, `graph.ts`

`loadKnowledgeBase(source, config)` is the single assembly path:

1. `source.getRepoData()` → `RepoData`.
2. `registerProviders(registry, data)` + external providers from `config.providers`.
3. `orchestrateWithTransforms(registry, config, { readme })`:
   - **collect** — `collectProviderNodes` runs providers in dependency order,
     threading the accumulated `allNodes` into each `resolve`;
   - **transform** — `applyTransforms` runs the ordered post-provider stage
     (below);
   - **cluster** — `extractClusters` (`src/engine/parser.ts`);
   - **build** — `buildGraph` (`src/engine/graph.ts`).

### Ordered transform stage — `src/engine/transforms.ts` (Phase 3)

The ~150 lines of post-processing that used to be **duplicated inline in both
loaders** are now discrete, ordered `GraphTransform`s run by the orchestrator.
`DEFAULT_TRANSFORMS` (order is significant):

1. `readmeTransform` — synthesize the README node and cross-link it to issues
   (explicit refs, ≥60% fuzzy title match, directory mentions, inline markdown
   links) + a forced `→ repo-root` edge.
2. `issueDirectoryLinkTransform` — link each issue to directories its body
   references (runs **before** the split so links stay on the original node).
3. `issueSplitTransform` — split any issue with 2+ headings into parent +
   per-section nodes.

Loaders carry **no** post-processing; they only build the `TransformContext`
(the source README) and hand it to the orchestrator.

### Graph engine — `src/engine/graph.ts`

`buildGraph(nodes, clusters)`:

1. `buildEdges` — each `node.connections[]` → deduped `KBEdge` (keyed by
   unordered pair) + `parent → child` `contains` edges; weight from
   `conn.weight ?? getEdgeWeight(type)`.
2. **Orphan reattachment** — any edge-less node links to a connected same-cluster
   sibling, else the highest-degree hub, via an inferred `related` edge.
3. `computeRelated` — per node, ranks neighbors by max edge weight (tie-break:
   degree), keeps the top **12** → `related: Record<id, id[]>`.

Result: pure `KBGraph { nodes, edges, clusters, related }`.

### Identity — `src/engine/identity.ts`

`assignIdentity(node)` derives a canonical `urn:` from `node.source`; providers
and the transform stage call it as they mint nodes. `buildIdentityIndex(nodes)`
maps `identity → [nodeId…]` for the **view** layer to merge representations that
share an identity (a read-time concern, not a build-time dedupe).

## Layer 4 — Representation — `src/representation/**` (Phases 2 & 6)

A `Representation` takes the **pure** `KBGraph` (+ options) and produces an
output artifact. `RepresentationRegistry` (`src/representation/registry.ts`) maps
a target name to its implementation; `representationRegistry`
(`src/representation/targets/index.ts`) is pre-populated with the built-ins:

| Target | File | Output |
|--------|------|--------|
| `spa` | `src/representation/targets/spa.tsx` | the interactive explorer website (React route tree) |
| `json-ld` | `src/representation/targets/json-ld.ts` | deterministic, canonicalized JSON-LD `@graph` |
| `llm-context` | `src/representation/targets/llm-context.ts` | **neighbor-anchored**, token-budgeted Markdown pack |

`json-ld` and `llm-context` consume only the pure graph and **never import the
engine/loader** — enforced statically by
`src/representation/targets/__tests__/no-engine-import.test.ts`. `llm-context` is
always anchored on one or more nodes and emits navigable `kg://` hypermedia links
for relevant-but-unexpanded neighbors — it **never** serializes the whole graph.

Representation **styling** also lives in this layer (moved out of the core data
types in Phase 2): `EDGE_TYPE_STYLES` / `RELATION_STYLES` / `NODE_LAYER_META`
(`src/representation/styles.ts`) and `BUILT_IN_VIEWS` (`src/representation/views.ts`).

## Write path (affordances) — `src/engine/source-edit.ts`

Read is the default flow above. Edits go through `source-edit.ts`
(`canEditSource`, `buildEditUrl`, `buildHandoffUrl`, `buildUnifiedDiff`, …),
which is GitHub-web/handoff oriented. The first-class **staging-area** resource
and per-retrieval **affordances/links** now exist on the `Source` surface
(`GitHubApiSource`, §4A) as the formal model; mutation beyond the contract is
intentionally minimal/read-first.

## Determinism & the golden guardrail

`buildGraph` is deterministic for a fixed node set; `tests/golden/serialize.ts`
canonicalizes (sorted object keys; nodes by `id`; edges by
`(from,to,type,relation)`; clusters by `id`; ranked `related`) so two builds
serialize to identical bytes. Both graph golden tests are **hermetic** — they
read the committed `tests/golden/fixtures/manifest.json` snapshot, never the
gitignored generated manifest.

Golden tests (run by `npm test`, regenerate with `npm run golden:update`):

- `tests/golden/local-graph.test.ts` — local build from `fixtures/manifest.json`
  vs `local-graph.golden.json`.
- `tests/golden/remote-graph.test.ts` — remote build against recorded fixtures,
  hermetic (no network), vs `remote-graph.golden.json`.
- `tests/golden/local-jsonld.test.ts` — the `json-ld` representation vs
  `local-jsonld.golden.json`.
- `tests/golden/local-llm-context.test.ts` — the `llm-context` representation vs
  `local-llm-context.golden.md`.

Every phase of the decoupling kept these byte-identical until a seam was
intentionally flipped; any change to the flow above must regenerate the goldens
so the diff is reviewable.
