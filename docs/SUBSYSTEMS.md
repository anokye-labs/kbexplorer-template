# SUBSYSTEMS — current data flow (Phase 0 inventory)

> **Status:** descriptive, not aspirational. This documents how the template
> builds a `KBGraph` *today*, before the Phase 3 decoupling refactor. Its main
> job is to **name every place post-processing happens outside a provider** so
> Phase 3 has a complete inventory to migrate. Where the code has a known seam
> or smell, it is called out as a **⚠︎ Phase 3 target**.

## Pipeline at a glance

```
                 ┌──────────────────────────────────────────────┐
   source data   │  loader  (local-loader.ts | remote-loader.ts) │
  (manifest /    │   • resolve config                            │
   GitHub API)   │   • construct + register providers            │
                 │   • collectProviderNodes(registry, config)    │ ← orchestrator
                 │   • POST-PROCESSING (outside providers) ⚠︎     │
                 │   • extractClusters(allNodes, config)         │ ← parser
                 │   • buildGraph(allNodes, clusters)            │ ← graph engine
                 └───────────────────────┬──────────────────────┘
                                         │  KBGraph { nodes, edges, clusters, related }
                                         ▼
                                  views / representations
                       (vis-network SPA · per-node viewers · JSON-LD)
```

Two entry points, one shared shape:

| Mode | Entry point | Source of data |
|------|-------------|----------------|
| local (`VITE_KB_LOCAL=true`) | `loadLocalKnowledgeBase()` → `loadLocalKnowledgeBaseV2()` in `src/engine/local-loader.ts` | pre-built `src/generated/repo-manifest.json` |
| remote (default) | `loadRemoteKnowledgeBase()` in `src/engine/remote-loader.ts` | live GitHub API via `src/api` |

Both converge on the **same** orchestrator → post-processing → `buildGraph`
sequence, and both emit the identical `KBGraph` interface (`src/types/index.ts`).

## Layers

### 1. Loaders — `src/engine/local-loader.ts`, `src/engine/remote-loader.ts`

Responsibilities today (per loader, **duplicated**):

1. Resolve `KBConfig` (`loadLocalConfig()` / `config` off the fetched data).
2. Construct providers from source-shaped data and `registry.register(...)` them.
3. Call `collectProviderNodes(registry, config)`.
4. **Run post-processing transforms that are not in any provider** (see §6).
5. `extractClusters(allNodes, config)` then `buildGraph(allNodes, clusters)`.

⚠︎ **Phase 3 target:** steps 2 and 4 are ~150 lines that are near-identical
between the two loaders. The provider wiring differs only in *where the bytes
come from* (manifest vs API); the post-processing in step 4 is copy-pasted. This
is the single biggest source of drift between local and remote output.

### 2. Provider registry + orchestrator — `src/engine/providers.ts`, `src/engine/orchestrator.ts`

- `ProviderRegistry` holds providers and exposes `getExecutionOrder()`
  (dependency-ordered via each provider's `dependencies: string[]`).
- `collectProviderNodes(registry, config)` runs providers **in order**, passing
  the **accumulated `allNodes`** to each `provider.resolve(config, existingNodes)`
  so later providers can read/augment earlier output. Each provider returns
  `{ nodes, edges }`; the orchestrator currently collects **nodes only** here
  (edges are recomputed in `buildGraph` from `node.connections` + `parent`).
- `orchestrate()` is the all-in-one variant (collect → clusters → buildGraph);
  the loaders deliberately use `collectProviderNodes` instead so they can splice
  in post-processing before `buildGraph`.

### 3. Providers — `src/engine/providers/*`

Each implements `GraphProvider { id, name, dependencies, resolve() }`.

| Provider | Emits | Identity assigned |
|----------|-------|-------------------|
| `FilesProvider` | directory/`tree` nodes | `urn:file:<path>` |
| `AuthoredProvider` | authored markdown nodes (+ node-map) | `urn:content:<id>` |
| `WorkProvider` | issues, PRs, commits, releases, repo-root | `urn:issue:…` etc. |
| `PersonProvider` | people derived from GitHub activity | `urn:person:<login>` |
| `StructuralProvider` | repository node from `.github/**` | (structural) |
| `ContentModelProvider` | content-model spine (no-op if absent) | — |
| external (`WikipediaProvider`, `OrgChartProvider`, …) | reference nodes | provider-scoped |

External providers are loaded from `config.providers` via
`loadExternalProviders()` in `src/engine/plugin-loader.ts`.

⚠︎ **Phase 3 / Phase 5 target:** `plugin-loader.ts` hardcodes a `switch` over
known `type`s and warns *"Custom provider type not yet supported"* for anything
else — 3rd-party/local-ESM providers cannot actually load yet.

### 4. Identity — `src/engine/identity.ts`

- `assignIdentity(node)` derives a canonical `urn:` from `node.source`. It is
  **not** a separate pipeline pass: providers (and `parser.ts`) call it as they
  mint nodes. The README post-processing block hand-sets
  `identity: 'urn:content:readme'` inline.
- `buildIdentityIndex(nodes)` maps `identity → [nodeId, …]` for the **view**
  layer to merge representations that share an identity. There is **no
  identity-based node merge during graph construction today** — the "merge" is a
  read-time concern in views, not a build-time dedupe.

⚠︎ **Phase 3 note:** the "identity-merge" stage named in the plan does not exist
as a build step yet; today identity is (a) assigned per-node at creation and
(b) indexed for views. Phase 3 should decide whether merge becomes a real pass.

### 5. Graph engine — `src/engine/graph.ts` (`buildGraph`) + clustering in `src/engine/parser.ts`

`buildGraph(nodes, clusters)`:

1. `buildEdges` — turns each `node.connections[]` into deduped `KBEdge`s (keyed
   by unordered pair) and adds `parent → child` `contains` edges. Edge weight
   comes from `conn.weight ?? getEdgeWeight(type)`.
2. **Orphan reattachment** — any node touched by no edge is linked to a
   connected same-cluster sibling, else the highest-degree **hub** node, with an
   inferred `related` edge.
3. `computeRelated` — per node, ranks neighbors by max edge weight (tie-break:
   neighbor degree) and keeps the top **12** → `related: Record<id, id[]>`.

Result: `KBGraph { nodes, edges, clusters, related }` (`src/types/index.ts`).

⚠︎ **Phase 3 note:** orphan reattachment and the README/auto-link transforms
(§6) are the things that make output sensitive to node-set changes; they belong
behind explicit, testable seams.

### 6. ⚠︎ Post-processing OUTSIDE any provider (the Phase 3 migration list)

These run in **both** loaders, after `collectProviderNodes` and before
`buildGraph`. They are the explicit inventory Phase 3 must relocate into
providers/transforms. Code: `local-loader.ts` ~L410–499, `remote-loader.ts`
~L232–314 (near-identical).

1. **README node creation + cross-linking.** Builds a synthetic `id: 'readme'`
   node and computes its `connections` by:
   - explicit issue refs (`extractIssueRefs`) → `issue-<n>`;
   - **fuzzy title match** — issue linked if ≥60% of its >3-char title words
     appear in the README text (`Mentions`);
   - directory mentions (`dir/` or `` `dir` ``);
   - a forced `→ repo-root` (`Documents`) edge;
   - inline markdown links `[text](target)` to in-graph node ids.
   Then renders `content` HTML via `marked`.
2. **Issue → directory auto-linking.** For every issue node, scans `rawContent`
   for each directory name (`dir/`, `` `dir` ``, or case-insensitive substring)
   and pushes a `References dir/` connection. ⚠︎ substring matching is noisy.
3. **Issue splitting into sections.** `splitIntoSections(...)` (from
   `parser.ts`) expands any issue with 2+ headings into a parent + per-section
   nodes; the original issue node is spliced **out** of `allNodes` and the
   section nodes pushed in. Runs *after* auto-linking so connections stay on the
   original node before the split.

Other notable transforms that live in providers but behave like post-processing:
- `PersonProvider` mutates an existing descriptor node's `data`/`connections`
  in place (active-work enrichment) rather than only emitting new nodes.

### 7. Views / representations — `src/views/**`, `src/types` (`jsonld`)

The `KBGraph` is consumed by:
- the **vis-network SPA** (force-directed canvas + HUD minimap; positions via
  `computeGraphPositions`);
- **per-node viewers** selected by `src/views/viewers/registry.ts` (typed views
  like `PersonView`, `SquadView`, `DecisionView`, …);
- **JSON-LD** carried on `node.jsonld` (contract in
  `src/types/__tests__/jsonld-contract.test.ts`).

⚠︎ representation styling (edge colors, `BUILT_IN_VIEWS`) is still mixed into
`src/types/index.ts`, so the graph cannot yet be consumed as pure data — a
Phase 2/Phase 6 target. There is **no `llm-context` target yet** (Phase 6).

## Write path (affordances) — `src/engine/source-edit.ts`

Read is the default flow above. Edits today go through `source-edit.ts`
(`canEditSource`, `buildEditUrl`, `buildHandoffUrl`, `buildUnifiedDiff`, …),
which is GitHub-web/handoff oriented. The first-class **staging-area** resource
and per-retrieval **affordances/links** described in the plan do **not** exist
yet (Phase 4).

## Determinism & the golden guardrail (this phase)

`buildGraph` is deterministic for a fixed node set, but JSON key/element order is
not guaranteed. `tests/golden/serialize.ts` canonicalizes (sorted object keys;
nodes by `id`; edges by `(from,to,type,relation)`; clusters by `id`; `related`
keys sorted, value arrays keep ranked order) so two builds serialize to
identical bytes.

Both golden tests are **hermetic** — they never touch the gitignored,
environment-generated `src/generated/repo-manifest.json`. Instead a snapshot of
it is committed at `tests/golden/fixtures/manifest.json` and is the single source
of truth for both fixtures. The local test drives the loader's extracted pure
builder `buildKnowledgeBaseFromManifest(manifest, config)` (in `local-loader.ts`)
with that fixture; `build-remote-fixture.mjs` reshapes the same fixture into
`fixtures/remote-api.json` for the remote test.

Golden tests (run by `npm test`, regenerate with `npm run golden:update`):
- `tests/golden/local-graph.test.ts` — local build from `fixtures/manifest.json`
  vs `local-graph.golden.json`.
- `tests/golden/remote-graph.test.ts` — remote build against **recorded**
  fixtures (`fixtures/remote-api.json` + `fixtures/wikipedia.json`), hermetic
  (no network), vs `remote-graph.golden.json`.

Any change to the flow above must regenerate the goldens, making the diff
reviewable — which is exactly the guardrail the Phase 3 refactor needs.
