# SUBSYSTEMS — current data flow

> **Status:** descriptive of the codebase **after** the Epic #298 decoupling
> (Phases 0–6, all merged). It documents the stabilized **four-layer pipeline**
> — **Sources → Providers → Engine (pure `KBGraph`) → Representation** — backed
> by the shared `@anokye-labs/kbexplorer-core` contracts package. For the
> historical Phase-0 inventory (the two "fat loaders" and out-of-provider
> post-processing this refactor removed), see the file history of this doc.

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

- graph + config: `KBNode`, `KBEdge`, `KBGraph`, `KBConfig`, identity/URN (`kg://`),
  relation taxonomy, JSON-LD helpers (`buildJsonLd`);
- the layer interfaces: `Source` / `Resource` / `Affordance` / `Link`,
  `GraphProvider`, `Representation`.

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
| `ManifestSource` | `sources/manifest-source.ts` | every resource `['read']` only — a frozen snapshot has no staging area |
| `GitHubApiSource` | `sources/github-api-source.ts` | composite **Git ≠ GitHub** families; **per-retrieval** affordances |

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
| `AuthoredProvider` | authored-markdown nodes (+ node-map) |
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
| `spa` | `targets/spa.tsx` | the interactive explorer website (React route tree) |
| `json-ld` | `targets/json-ld.ts` | deterministic, canonicalized JSON-LD `@graph` |
| `llm-context` | `targets/llm-context.ts` | **neighbor-anchored**, token-budgeted Markdown pack |

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
