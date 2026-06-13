# TESTING.md — kbexplorer test pyramid and CI orchestration

This document is the canonical map of the entire testing system for the
kbexplorer project. It covers both the template app
(`anokye-labs/kbexplorer-template`) and the CLI
(`anokye-labs/kbexplorer-cli`). Read this first; then follow the cross-links
below for deeper detail on each subsystem.

---

## Overview — the pyramid

Testing is arranged in six layers, ordered from fastest and cheapest (unit
tests with no external dependencies) up to slowest and most environment-heavy
(exploratory-agent harness that stages a live Podman+Gitea universe). Each
layer is additive and opt-in above the fast PR gate.

```
                    ┌─────────────────────────────────┐
                    │  6. Exploratory-agent harness    │  nightly 06:00 UTC + manual
                    │     explore-dtu.yml              │  (emit brief; no auto-commit)
                    └─────────────────────────────────┘
                   ┌───────────────────────────────────┐
                   │  5. Visual regression             │  nightly 05:15 UTC + manual
                   │     visual-regression.yml         │  (pixelmatch baseline diff)
                   └───────────────────────────────────┘
                  ┌─────────────────────────────────────┐
                  │  4. Full-loop scenario              │  manual / local (not yet in nightly CI)
                  │     playwright.full-loop.config.ts  │  actor → regen → render → verify
                  └─────────────────────────────────────┘
                 ┌───────────────────────────────────────┐
                 │  3. Live-DTU scenario specs           │  nightly 04:30 UTC + manual
                 │     playwright.gitea.config.ts        │  dtu-gitea.yml / e2e/gitea/
                 └───────────────────────────────────────┘
          ┌──────────────────────────────────────────────────┐
          │  2. Static-twin fast e2e gate                    │  PR gate + push to main
          │     playwright.config.ts / e2e/*.spec.ts         │  (testIgnore: gitea + full-loop)
          └──────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────────┐
    │  1. Unit tests                                              │  PR gate + push to main
    │     vitest (template) · node:test (CLI)                     │
    └─────────────────────────────────────────────────────────────┘
```

Layers 1 and 2 form the **fast PR gate** — they run on every pull request and
on every push to `main`, with no external services, no Podman, and no live
browser against real APIs. Layers 3–6 are **deliberately excluded from the
fast gate** and run only on nightly schedules or on-demand via
`workflow_dispatch`. The reason is explained in the CI orchestration section
below.

---

## Layer 1 — Unit tests

**Covers:** Pure logic in the template app (graph engine, providers, theming,
search, API client, type contracts, hook behaviour, content-model builder,
viewer registry) and the CLI (command implementations, manifest generation,
lib utilities). All tests run without a browser and without network.

**Twin used:** None. The template's unit tests use mocked or fixture data
inline. The CLI's tests use fixtures under `tests/fixtures/`.

**Where it runs:** PR gate and every push to `main`.

**How to run locally:**

```bash
# Template app (vitest)
npm test
# → vitest run --config vitest.config.ts

# CLI (node:test)
npm test
# → node --test tests/**/*.test.js
```

**Template test files** (selected by `vitest.config.ts` include globs):
- `src/**/__tests__/**/*.test.ts` — engine, providers, theming, hooks, API,
  search, types, content-model, viewers (~44 test files)
- `scripts/**/__tests__/**/*.test.js` — manifest generation, twin-fixture
  validation
- `twins/**/__tests__/**/*.test.{js,mjs,ts}` — adapter unit tests
  (`twins/gitea/__tests__/adapter.test.mjs`)

**CLI test files** (discovered by the `tests/**/*.test.js` glob):
- `tests/commands/*.test.js` — `derive`, `dev`, `doctor`, `generate`, `links`,
  `mcp-gating`, `scaffold`
- `tests/lib/*.test.js` — `affected`, `args`, `audit`, `copilot-runtime`,
  `detect-repo`, `docx`, `extract`, `gh-fetch`, `ingest`, `jsonld`,
  `manifest-apibase`, `manifest`, `mcp-preflight`, `runtime-adapters`,
  `runtime-config`, `runtime-router`, `source`, `transform`

**Holdout note:** N/A. Unit tests cover implementation contracts; they do not
serve as the acceptance gate for user-visible scenarios (that is the role of
layers 2–4).

---

## Layer 2 — Static-twin fast e2e gate

**Covers:** End-to-end Playwright specs that verify the full browser-rendered
app behaves correctly against a deterministic, zero-dependency GitHub API
fixture twin. Covers navigation, search, cluster collapse, entity nodes,
structural nodes, display modes, landing mode, layer views, integration
validation, and visual-validation snapshots — all in Chromium (and Edge, for
the local `edge` project) against a `vite preview` server backed by the
static twin.

**Twin used:** `twins/github/` — canned JSON fixtures served by
`twins/github/server.js` on port 3456. The twin is started automatically by
`playwright.config.ts`'s `webServer` array alongside `vite preview` on port
4173.

**Where it runs:** PR gate (inside `github-pages.yml` `test` job) and every
push to `main`.

**How to run locally:**

```bash
npm run test:e2e
# → playwright test --project=chromium   (CI)
# → playwright test                       (local; runs edge + chromium)

npm run test:e2e:ui    # interactive Playwright UI mode
```

**Spec files** (everything under `e2e/` except `e2e/gitea/**` and
`e2e/full-loop/**`, which are excluded via `testIgnore` in
`playwright.config.ts`):
- `e2e/cluster-collapse.spec.ts`
- `e2e/display-modes.spec.ts`
- `e2e/entity-nodes.spec.ts`
- `e2e/integration-validation.spec.ts`
- `e2e/landing-mode.spec.ts`
- `e2e/layer-views.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/search.spec.ts`
- `e2e/smoke.spec.ts`
- `e2e/structural-nodes.spec.ts`
- `e2e/twin-api.spec.ts`
- `e2e/visual-validation.spec.ts`

**What also runs in the PR gate** (`github-pages.yml` `test` job, before the
Playwright step):
- `npm test` (vitest unit tests — layer 1)
- `node scripts/generate-manifest.js` (manifest generation)
- `npm run validate` (graph validation)
- `npm run validate:drift` (manifest idempotency check)
- `node scripts/assess-graph.js --gate` (graph quality gate)

**Holdout note:** These specs are the authored, committed acceptance gate.
They measure the app against the canned fixture twin. Do not add
environment-specific assertions that pass only in one runner — keep them
portable.

---

## Layer 3 — Live-DTU scenario specs (`e2e/gitea/`)

**Covers:** Playwright specs that verify the full app against a real,
stateful Gitea server in a Podman container. Actors mutate the twin (open
issues, push branches, open and merge PRs), then the spec asserts the app
reflects those mutations on refresh. This validates the `ETag`/`304`
cache-refresh contract and the multi-actor workflow that the static twin
cannot simulate.

**Twin used:** `twins/gitea/` — a live Gitea-in-Podman universe. The
`playwright.gitea.config.ts` `globalSetup` (`twins/gitea/global-setup.ts`)
runs `bootstrap.mjs` and `seed.mjs` before any spec runs. The
`twins/gitea/server.mjs` adapter sits between the app and Gitea, translating
GitHub REST ↔ Gitea API.

Dedicated ports (set by `playwright.gitea.config.ts`, overridable via env):
- Gitea → Podman container on port 3000
- Adapter → listens on `TWIN_PORT`. This suite sets `TWIN_PORT` from
  `DTU_TWIN_PORT` (default **3557**) so it can coexist with the standalone
  adapter (`npm run dtu:twin`), which defaults to `TWIN_PORT` 3456.
- App (`vite dev`) → `DTU_APP_PORT` (default **4319**)

**Where it runs:** Nightly at **04:30 UTC** (`dtu-gitea.yml` schedule) and
on-demand via `workflow_dispatch`. Never on the PR gate.

**How to run locally** (requires Podman):

```bash
npm run test:e2e:gitea
# → playwright test --config playwright.gitea.config.ts
# globalSetup brings up Podman + Gitea automatically

npm run dtu:up          # manual bringup (idempotent)
npm run dtu:seed        # push snapshot + seed issues/PRs
npm run dtu:twin        # start adapter alone (port 3456)
npm run dtu:down        # stop + remove container
npm run dtu:reset       # down --purge + fresh bootstrap + seed
```

**Spec files** (`e2e/gitea/`):
- `adapter-refresh.spec.ts` — adapter synthesizes GitHub headers; ETag→304
  honoured; mutation invalidates cache
- `issue-lifecycle.spec.ts` — newly opened issue surfaces as a node on a
  cache-fresh load; cached load hides it until refresh
- `pr-and-merge.spec.ts` — actor-opened PR appears as a Pull Request node;
  merging a README edit updates the README node after refresh
- `workgraph-mutations.spec.ts` — multi-mutation workgraph scenario

**Holdout note:** Assertions live in `e2e/gitea/*.spec.ts` only — never
inside `adapter.mjs`, `seed.mjs`, or any file under `twins/`. The twin
translates faithfully; the specs measure real app behaviour. Agent-authored
specs land through **human-reviewed PRs**, never auto-committed.

---

## Layer 4 — Full-loop scenario (`e2e/full-loop/`)

**Covers:** The complete deployment shape: an actor mutates the twin, the CLI
regenerates the manifest (via `KBEXPLORER_GH_API_BASE`), the app serves in
local mode from the freshly generated manifest, and the spec asserts the
mutation is visible in the rendered graph. This validates that the CLI
pipeline and the app's local-mode rendering stay in sync.

**Twin used:** By default (`FULL_LOOP_SUBSTRATE=static`), the full-loop suite
uses the static `twins/github` twin for actor injection. The live-Gitea path
(`FULL_LOOP_SUBSTRATE=gitea`) is deferred — it requires Podman, the Gitea
adapter, and a wired `globalSetup` calling the Gitea actors. The spec
assertions are substrate-agnostic and will pass unchanged once the Gitea path
is wired.

App port: 4318 (`FULL_LOOP_APP_PORT`). The `globalSetup`
(`e2e/full-loop/global-setup.mts`) handles the mutable-twin setup and manifest
regen before specs run.

**Where it runs:** Manual / local only. As of this writing **no scheduled
workflow invokes the full-loop config** — `dtu-gitea.yml` (the nightly DTU job)
runs only `npm run test:e2e:gitea` (layer 3). Wiring the full-loop into a
nightly job (or extending `dtu-gitea.yml` to also run it) is tracked in
[#269](https://github.com/anokye-labs/kbexplorer-template/issues/269). Run it
manually with:

```bash
npm run test:e2e:full-loop
# → playwright test --config playwright.full-loop.config.ts
```

**Spec files** (`e2e/full-loop/`):
- `actor-regen-render.spec.ts` — the primary actor→regen→render→verify scenario

**Holdout note:** Same as layer 3 — assertions stay in specs, never in the twin
or the CLI logic. The CLI must regenerate correctly from the twin's data; the
spec measures whether it does.

---

## Layer 5 — Visual regression (`capture:review` + `verify:visual`)

**Covers:** Perceptual screenshot comparison of the full app UI surface set —
9 views × 4 themes × 2 viewports = up to 72 PNG captures — against committed
baseline images stored in `review/baselines/`. Uses `pixelmatch` (tolerance
0.1 per channel, fail gate: > 0.5% differing pixels) so minor anti-aliasing
variance between environments is tolerated while real layout shifts fail.

**Twin used:** None at test time. The app is built in local mode
(`VITE_KB_LOCAL=true`) from a generated manifest and served via `vite preview`
on port 4173. The capture script (`scripts/capture-review.mjs`) boots its own
Playwright/Chromium session.

**Where it runs:** Nightly at **05:15 UTC** (`visual-regression.yml` schedule)
and on-demand via `workflow_dispatch`. Never on the PR gate.

**How to run locally:**

```bash
npm run capture:review          # build + capture all surfaces
npm run verify:visual           # diff captures vs review/baselines/

# Skip the build if dist/ is current:
npm run capture:review -- --skip-build
npm run verify:visual

# Promote captures to new baselines (after an intentional design change):
npm run capture:review -- --update-baselines
git add review/baselines
git commit -m "chore(review): update visual baselines"

# Convenience alias (same as --update-baselines):
npm run update:baselines
```

**Artifacts** (uploaded by `visual-regression.yml`):
- `review-screenshots-<run>` — fresh captures
- `review-diffs-<run>` — diff PNGs (on failure)
- `visual-diff-report-<run>` — `review/visual-diff-report.json`
- `refreshed-baselines-<run>` — only on a `update_baselines=true`
  dispatch run; download and commit manually

**Holdout note:** Baselines are the committed reference. They must be updated
deliberately (a human commit) when the design changes intentionally. The gate
is not wired into the PR merge path precisely because environment-sensitive
PNG rendering would cause false failures across OS/font-render differences.

---

## Layer 6 — Exploratory-agent harness (`explore:dtu`)

**Covers:** Staging a live Gitea DTU and emitting a machine-readable session
brief that an external orchestrator uses to launch exploratory agent sessions.
The harness itself does not call any LLM or run any Playwright specs. Agent
sessions probe the running DTU via actors, find gaps, and open human-reviewed
`e2e/gitea/*.spec.ts` PRs. Those PRs, once merged, add coverage to layer 3.

**Twin used:** `twins/gitea/` — full Podman+Gitea bringup identical to
layer 3, but the harness also starts the Vite dev server on port 4319
(`EXPLORE_APP_PORT`) with `VITE_GH_API_BASE` pointed at the adapter.

**Where it runs:** Nightly at **06:00 UTC** (`explore-dtu.yml` schedule) and
on-demand via `workflow_dispatch` (with optional `skip_app` and `write_brief`
inputs). Never on the PR gate.

**How to run locally** (requires Podman):

```bash
npm run explore:dtu
# Full bringup: dtu:up + dtu:seed + adapter + vite dev + probing prompt

EXPLORE_SKIP_DTU=1 npm run explore:dtu   # DTU already running
EXPLORE_NO_APP=1 npm run explore:dtu     # adapter-only staging
EXPLORE_WRITE_BRIEF=1 npm run explore:dtu  # write .dtu/session-brief.json
```

The script blocks after printing the probing prompt, keeping servers alive.
Press Ctrl-C to stop.

**Session brief** written to `.dtu/session-brief.json` (gitignored) and
uploaded as the `explore-dtu-brief-<run-id>` CI artifact (retention: 7 days).

**Holdout note:** The harness never auto-commits. Specs authored by agent
sessions must be submitted as PRs and pass human review before joining the
layer-3 nightly suite.

---

## The holdout rule

> Assertions live in specs only — never inside the twin.

The twins (`twins/github/`, `twins/gitea/`) are **faithful translators**:
the static twin replays canned GitHub responses; the Gitea twin translates
GitHub REST to Gitea API. Neither twin contains any assertion or
special-casing logic for a particular test outcome.

Concretely:
- Do NOT modify `adapter.mjs`, `seed.mjs`, `server.mjs`, or any fixture under
  `twins/` to make an assertion pass.
- Do NOT write code in the app or CLI that detects it is running against the
  twin and behaves differently.
- Agent-authored specs from exploratory sessions land through **human-reviewed
  PRs** — they are never auto-committed to `main`.

See [DTU.md](DTU.md) for the full holdout discipline, twin architecture, and
the rationale behind the two-twin model.

---

## CI orchestration across both repos

The table below reconciles what runs where, and why the heavy jobs are
deliberately kept off the fast PR gate.

### `anokye-labs/kbexplorer-template` workflows

| Workflow | File | Trigger | What it runs |
|----------|------|---------|--------------|
| Deploy to GitHub Pages | `github-pages.yml` | push `main`, PR→`main`, `workflow_dispatch` | unit tests (vitest) → manifest gen → graph validate + drift + quality gate → build → e2e static-twin (Playwright, layer 2) → Pages deploy (push only) |
| dependency-review | `dependency-review.yml` | PR (opened / sync / reopened / ready) | `actions/dependency-review-action@v4` (skipped on private repos) |
| pr-title | `pr-title.yml` | PR (opened / edited / sync / reopened / ready) | validates PR title not empty / not WIP / not draft |
| linked-issue | `linked-issue.yml` | PR (all states including labeled) | requires issue reference in title or body (bots exempt) |
| DTU — Gitea multi-agent harness | `dtu-gitea.yml` | `workflow_dispatch`, nightly **04:30 UTC** | Podman+Gitea bringup → `npm run test:e2e:gitea` (layer 3) → upload `playwright-report-gitea` → `dtu:down` |
| Visual Regression | `visual-regression.yml` | `workflow_dispatch` (`update_baselines` input), nightly **05:15 UTC** | manifest gen → build → `capture:review` → `verify:visual` (layer 5) → upload screenshots / diffs / baselines |
| Exploratory-agent harness | `explore-dtu.yml` | `workflow_dispatch` (`skip_app`, `write_brief` inputs), nightly **06:00 UTC** | Podman+Gitea bringup → `node scripts/explore-dtu.mjs` (5-min cap) → upload `session-brief.json` → `dtu:down` (layer 6) |

### `anokye-labs/kbexplorer-cli` workflows

| Workflow | File | Trigger | What it runs |
|----------|------|---------|--------------|
| Publish to npm | `publish.yml` | push `v*` tags | `npm test` (node:test, layer 1) → `npm publish --access public` |
| dependency-review | `dependency-review.yml` | PR (opened / sync / reopened / ready) | `actions/dependency-review-action@v4` |
| pr-title | `pr-title.yml` | PR (all) | validates PR title |
| linked-issue | `linked-issue.yml` | PR (all states) | requires issue reference |

### What is on the fast PR gate and what is not

| Test layer | Template PR gate | CLI PR gate | Why excluded from gate |
|------------|-----------------|-------------|----------------------|
| Unit tests (vitest / node:test) | Yes | Yes (on tag) | — |
| Graph validate + quality gate | Yes (template only) | N/A | — |
| Static-twin e2e (Playwright) | Yes | N/A | — |
| Live-DTU scenario specs | **No** | N/A | Requires Podman + real Gitea container; 25-min timeout |
| Full-loop scenario | **No** | N/A | Requires Podman / CLI sibling; 2-min per-spec timeout |
| Visual regression | **No** | N/A | Full build + real browser + OS font-render variance; intentional design changes must update baselines deliberately |
| Exploratory-agent harness | **No** | N/A | Stages a live DTU + emits brief; no deterministic pass/fail signal |

The CLI has **no PR-gate CI** beyond the four housekeeping checks above; unit
tests only run as part of the publish pipeline (on `v*` tag push). There is no
equivalent of the template's `github-pages.yml` for the CLI.

---

## Cross-links

| Resource | Path |
|----------|------|
| DTU architecture, holdout discipline, two-twin model | [DTU.md](DTU.md) |
| Exploratory-agent harness reference (loop, brief format, actors, CI) | [docs/exploratory-agent.md](docs/exploratory-agent.md) |
| Gitea twin file map, actor reference, scenario specs, env vars | [twins/gitea/README.md](twins/gitea/README.md) |
| Visual regression — surface set, baselines, diff approach, gate | [review/README.md](review/README.md) |
| Static GitHub fixture twin | [twins/github/README.md](twins/github/README.md) |
