# Requirements: A View of Each File (provider-shipped viewers)

**Status:** Draft requirements — design not started. This document deliberately
stops at requirements; several design decisions depend on repositories not
audited yet (see [Repositories required for design](#repositories-required-for-design)).

## Capability statement

Every file surfaced by KB Explorer should resolve to a real, typed
visualization when opened on any KBX surface — not a raw dump, and not a
generic fallback for anything beyond the handful of built-in kinds. External
provider packages (separate repos) must be able to deliver **both halves** of
a new type: the ingestion that maps structured files into nodes, *and* the
viewer that renders those nodes. Today they can only deliver the first half.

## Current state (verified in-repo)

The data side is open and extensible; the render side is host-only.

| Seam | Where | Extensible from an external package today? |
| --- | --- | --- |
| File → node mapping (rules) | `structured-node-map.yaml` + `StructuralProvider` (`src/engine/providers/structural-provider.ts`) | Yes — declarative rules, plus shape-inference fallback |
| File → node mapping (schema spine) | `content-model/` + `ContentModelProvider` (`src/engine/content-model/`) | Yes — drop entity YAML, no code |
| Custom ingestion | `defineProvider()` factories loaded via `config.yaml` `providers[].module` (`src/engine/plugin-loader.ts`) | Yes — this is the existing external-provider contract |
| Node → viewer routing | viewer registry, `src/views/viewers/registry.ts` (`resolveViewer`: `entityType` → JSON-LD `@type` → `GenericStructuredView`) | **No** — registrations happen only in `src/views/viewers/builtin-map.ts` at host startup (`src/main.tsx`) |
| Fenced-block rendering | block-renderer registry, `src/views/rich-markdown/` | **No** — host-only |
| Whole-graph surfaces | `RepresentationRegistry`, targets `spa` / `copilot` / `json-ld` / `llm-context` (`src/representation/targets/index.ts`) | **No** — host-only |
| Provider ↔ host compatibility | `PROVIDER_API_VERSION` (`1.0.0`) + `checkProviderCompatibility` in `@anokye-labs/kbexplorer-core` `src/provider.ts`; host advertises `['graph:nodes', 'graph:edges']` (`src/engine/plugin-loader.ts`) | Mechanism exists; no render-side capability defined |

Reference external provider: `@anokye-labs/kbexplorer-provider-rich-markdown`
(pure-ESM, dual `"."`/`"./lib"` exports, exports `apiVersion` +
frozen `capabilities`, emits nodes with `display`/`entityType`/`data` — no
viewers).

## Goals

1. Opening any file-derived node on the `spa` or `copilot` surface shows the
   most specific view available, degrading through explicit tiers:
   bespoke viewer → shape-inferred structured view → raw file view. No dead
   ends, and the tier reached should be observable (for coverage reporting).
2. A single external provider package can ship ingestion + viewers + block
   renderers for a new file type, installable via npm and enabled with one
   `config.yaml` entry — no host-repo code change.
3. The existing compatibility handshake governs the new surface area: a
   viewer-shipping provider on a host that doesn't support viewers degrades
   cleanly to data-only (nodes still render via `GenericStructuredView`).

## Non-goals

- New surfaces / `Representation` targets. This is about per-node views
  within existing surfaces.
- A provider marketplace, auto-discovery, or manifest-key mechanism.
  Loading stays explicit via `config.yaml` (`docs/providers.md`).
- Changing the two-identifier identity model, relation taxonomy, or the
  content-model spine.

## Functional requirements

**FR-1 — Viewer export hook.** Extend the provider-module contract (core
`ProviderModule`, `src/provider.ts`) with an optional render-side export so a
module can contribute viewer registrations keyed by `entityType`/`@type`.
Exact shape (component export vs. `register(registry)` callback vs. lazy
specifier) is a design decision — see open questions.

**FR-2 — Capability negotiation.** Render-side contributions are gated by new
`ProviderCapability` strings (working names: `'viewers'`,
`'block-renderers'`) checked through the existing
`checkProviderCompatibility` path. A host that doesn't advertise the
capability must load the provider's data half and skip the render half with a
logged warning — not reject the provider.

**FR-3 — Registry semantics preserved.** Provider-contributed viewers enter
the existing viewer registry under its current rules (case-insensitive,
last-registration-wins) so downstream packages can override built-ins.
Registration order across multiple external providers must be deterministic
(follow `config.yaml` order / provider execution order).

**FR-4 — Block renderers.** The same mechanism (or a parallel one) lets a
provider register fenced-block renderers into the rich-markdown block
registry, so a provider like rich-markdown can ship live renderers for its
allowlisted block languages (`dot`, `mermaid`, `ics`, `canvas`) instead of
relying on host-built ones.

**FR-5 — Fallback tiers unified.** A file matched by `nodemap.yaml` but not
by `structured-node-map.yaml` rules should still pass through shape
inference before landing as a raw file node, so the "plain file vs.
structured file" split (`nodemap.yaml` header comments) is invisible to the
user. Coverage tiering should be reportable (e.g. counts per tier) so
regressions in "view of each file" are measurable.

**FR-6 — Surface parity.** Provider-shipped viewers must work on both visual
surfaces (`spa` route tree and the `copilot` canvas served via
`canvas.html`). Non-visual targets (`json-ld`, `llm-context`) are unaffected
by viewer registrations.

**FR-7 — Reference implementation.** `kbexplorer-provider-rich-markdown`
becomes the first package shipping under the new contract (its block
renderers), and `examples/quotes-provider` gains a minimal custom viewer, so
`docs/providers.md` can document the authoring path end to end with two
runnable examples.

## Non-functional requirements

**NFR-1 — Security / trust model.** Viewers are executable React code, a
materially bigger grant than data-only providers. The existing specifier
policy must hold (local `./`/`../` and bare npm names only; absolute paths
and URL/scheme specifiers rejected — `classifySpecifier`,
`src/engine/plugin-loader.ts`). The design must state the trust model
explicitly (installing a provider ≈ installing a dependency) and consider an
opt-in config flag for enabling a provider's render half.

**NFR-2 — Purity boundary intact.** Representations consume only the pure
`KBGraph` (enforced by `targets/__tests__/no-engine-import.test.ts`). Viewer
registration must happen at host-composition time, not by representations
reaching into the engine/loader.

**NFR-3 — Versioning discipline.** The contract change is additive: minor
bump of `PROVIDER_API_VERSION` (not major), and existing data-only providers
continue to load unmodified. Core's policy applies (every exported type is
public API; additive = minor).

**NFR-4 — Packaging compatibility.** The mechanism must work for pure-ESM,
no-build-step packages (the rich-markdown pattern) in the Vite host. If
viewers require JSX/compiled output, the design must say how a no-build
provider ships them (precompiled `dist/`, `React.createElement`, or a
documented build recipe) without forcing a build step onto data-only
providers.

**NFR-5 — Testability.** Core gains contract tests for the new capability
strings and compatibility rules; the template gains loader tests for
viewer-registration order, capability-gated skip, and fallback tiers;
provider repos get a documented pattern for testing viewers against the real
core (extending the current `node:test` module-contract suite).

## Open questions (blocked on out-of-scope repos)

1. **Engine ownership.** Slice-1 moved pipeline internals (including
   `structured-node-map` map/parse) behind `@anokye-labs/kbexplorer-engine`
   shims (#472/#489). Does the provider-loading path (and therefore the
   viewer hook) belong in the engine or stay template-side? FR-5's fallback
   unification almost certainly lands in engine code.
2. **Canvas delivery.** The `copilot` surface is served by the kbexplorer
   CLI canvas-server over loopback. How does a provider's viewer code reach
   that bundle — is `canvas.html` built with the host app (viewers come for
   free) or served from a prebuilt artifact (viewers need a delivery path)?
3. **CLI compatibility matrix.** `docs/compatibility.md` pins CLI ↔ template
   versions; a `PROVIDER_API_VERSION` minor bump needs a row/policy there.
4. **Lazy loading.** Should viewer modules load eagerly with the provider or
   lazily on first node open (bundle-size impact on the SPA)?

## Repositories required for design

| Repo | Why | In this session? |
| --- | --- | --- |
| `anokye-labs/kbexplorer-core` | Contract change: `ProviderModule`, capabilities, `PROVIDER_API_VERSION` | Yes |
| `anokye-labs/kbexplorer-template` | Plugin loader, viewer + block registries, surfaces | Yes |
| `anokye-labs/kbexplorer-provider-rich-markdown` | Reference implementation (FR-7) | Yes |
| `anokye-labs/kbexplorer-engine` | Orchestrator + structured-node-map internals (template pins SHA `435226f`); resolves open questions 1 and 5 | **No** |
| `anokye-labs/kbexplorer-cli` | Canvas server / `copilot` delivery; compatibility matrix; resolves open questions 2–3 | **No** |

## Acceptance criteria

1. `npm install` of a provider package + one `config.yaml` entry yields a
   bespoke view for that provider's nodes on both `spa` and `copilot`
   surfaces, with zero host-repo code changes.
2. The same provider loaded on a host without the `'viewers'` capability
   still contributes nodes/edges, rendering via `GenericStructuredView`, with
   a single logged warning.
3. Every file node in the template's own repo graph renders at tier 1 or 2
   (bespoke or shape-inferred) — raw-file fallback occurs only for genuinely
   unstructured content, and a coverage report proves it.
4. `docs/providers.md` documents the render-side contract with two runnable
   examples; core's changelog records the additive `PROVIDER_API_VERSION`
   bump.
