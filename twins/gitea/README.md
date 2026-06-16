# Gitea Digital Twin Universe (DTU) — multi-agent harness

A **stateful** GitHub twin for kbexplorer. Where `twins/github/` is a fast static
fixture, this harness runs a **real Gitea server in Podman** and puts a
**GitHub-REST → Gitea-API translation proxy** on the same `VITE_GH_API_BASE`
seam. The app stays byte-for-byte unchanged; the proxy translates reads and
synthesizes the GitHub-style headers (`ETag`/`304`, `Link`, `X-RateLimit-*`,
`X-Total-Count`) that the app's refresh logic depends on.

This lets us validate the behaviour the static twin can't: **issues, PRs,
branches, and `main` mutating over time**, with the app faithfully reflecting
those changes on refresh.

```
actor (tea CLI / REST helpers)
        │  create/edit issues · push branches · open & merge PRs
        ▼
   Gitea  (Podman container, SQLite)
        ▲
        │ Gitea API v1
   adapter.mjs  ── server.mjs on TWIN_PORT (default 3456)
        ▲
        │ GitHub REST v3  (VITE_GH_API_BASE)
   kbexplorer app  (vite, remote/repo-aware mode)
```

## Prerequisites

- **Podman** (NOT Docker). The bootstrap starts the Podman machine if needed and
  runs a pinned `gitea/gitea` image with a SQLite backend.
- Node (the repo's toolchain). `tea` is downloaded on demand — no manual install.

Everything runtime lives under the gitignored **`.dtu/`** (state file, the cached
`tea` binary, isolated `tea` login config). Nothing here is ever committed and
no token ever reaches the browser.

## Quickstart

```bash
npm run dtu:up          # Podman machine + Gitea container + admin user/token
npm run dtu:seed        # snapshot the working tree → twin main + baseline issues/PRs
npm run dtu:twin        # serve the GitHub→Gitea adapter on TWIN_PORT (3456)

# point the app at the adapter (remote/repo-aware mode):
VITE_GH_API_BASE=http://localhost:3456 \
VITE_KB_OWNER=anokye-labs VITE_KB_REPO=kbexplorer-template VITE_KB_BRANCH=main \
  npm run dev

npm run test:e2e:gitea  # full scenario suite (bootstrap+seed run as globalSetup)
npm run dtu:down        # stop + remove the container (keeps .dtu state)
npm run dtu:reset       # down --purge + fresh bootstrap + seed
```

The scenario suite (`playwright.gitea.config.ts`) is **self-contained**: its
`globalSetup` runs bootstrap + seed, and it starts both the adapter and the app
on dedicated ports, so `npm run test:e2e:gitea` is all you need.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `GITEA_API` | `http://localhost:3000` | Gitea base URL |
| `GITEA_HTTP_PORT` | `3000` | Host port the container publishes |
| `GITEA_CONTAINER` | `kbe-gitea` | Podman container name |
| `GITEA_IMAGE` | `docker.io/gitea/gitea:1.24` | Pinned image |
| `GITEA_ADMIN_USER` / `_PASSWORD` / `_EMAIL` | `kbadmin` / … | First-run admin |
| `TWIN_PORT` | `3456` | Port the adapter serves on |
| `TEA_VERSION` | `0.14.1` | `tea` binary version to fetch |
| `KB_OWNER` / `KB_REPO` / `KB_BRANCH` | `anokye-labs` / `kbexplorer-template` / `main` | Repo coords the harness operates on |
| `DTU_APP_PORT` / `DTU_TWIN_PORT` | `4319` / `3557` | Ports the Playwright config uses (kept distinct so the suite coexists with other servers) |

`GITEA_TOKEN` / `GITEA_API` may also be supplied via env to override
`.dtu/state.json` (e.g. in CI against an externally-provisioned Gitea).

## File map

| File | Role |
|------|------|
| `bootstrap.mjs` | Start Podman + Gitea, create admin, mint an API token → `.dtu/state.json`. Idempotent. |
| `seed.mjs` | Force-push a snapshot of the working tree to twin `main`, create baseline issues + a seed PR. Idempotent. |
| `adapter.mjs` | The translation proxy. Pure helpers (`translatePath`, `translateQuery`, `normalizeIssue`, `paginate`, `computeEtag`, `buildLinkHeader`) + `createGiteaHandler()`. |
| `server.mjs` | HTTP entry point that mounts the adapter on `TWIN_PORT` and adds `/health` + CORS. |
| `state.mjs` | Repo-root + `.dtu/state.json` read/write + env-overridable defaults. |
| `gitea-client.mjs` | Minimal Gitea REST client used by seed + actors (issues, pulls, contents, branches, merge). |
| `tea.mjs` | Download/cache `tea`, configure an isolated login, `runTea()` wrapper. |
| `actors/*.mjs` | Deterministic actor bots (see below). |
| `teardown.mjs` | Stop/remove the container; `--purge` also deletes `.dtu/`. |
| `global-setup.ts` | Playwright `globalSetup`: runs bootstrap + seed before specs. |
| `__tests__/adapter.test.mjs` | Unit tests for the pure adapter helpers + handler (mocked fetch). |

Adapter translation details (per-page → limit, `recursive=1` → `recursive=true`,
`assignees: null` → `[]`, PR/issue feed splitting, header synthesis) are
documented inline at the top of `adapter.mjs`.

## Actors

Scripted actors drive Gitea via its REST API (fast, no binary download). Each is
importable from a spec **and** runnable as a CLI:

```bash
node twins/gitea/actors/open-issue.mjs  --title "Investigate flaky layout" --label bug
node twins/gitea/actors/edit-source.mjs --path content-model/people/ben.yaml --set title="Staff Engineer"
node twins/gitea/actors/merge-pr.mjs    --number 6 --style merge
```

- **`open-issue`** — opens a new (uniquely-titled) issue. Proves "a new work node
  appears after refresh".
- **`edit-source`** — edits an underlying **source-of-truth** entity file on a
  fresh branch and opens a PR (the multi-agent flow F5 exists for). Proves the
  app reflects a new PR node and, after merge, the changed file on `main`.
- **`merge-pr`** — merges a PR (waits for Gitea to compute mergeability, then
  merges), advancing `main`.

For interactive probing, use `tea` (Gitea's `gh`): `npm run dtu:tea -- issues ls`.

## Scenario specs (`e2e/gitea/`)

| Spec | What it proves |
|------|----------------|
| `adapter-refresh.spec.ts` | Live adapter synthesizes GitHub headers; honors `ETag`→`304`; a real mutation invalidates the cached representation. |
| `issue-lifecycle.spec.ts` | A newly opened issue surfaces as a node on a cache-fresh load; a cached load hides it until a refresh clears the cache. |
| `pr-and-merge.spec.ts` | An actor-opened PR appears as a Pull Request node; merging a README edit updates the README node on `main` after refresh. |

The suite runs serially (`workers: 1`) and uses unique, nonce'd titles, so runs
accumulate harmlessly against a warm twin.

## Exploratory-agent playbook

The harness is built so the **orchestrator** can launch agent sessions that
probe a *running* DTU and propose new repeatable specs.  The playbook below is
now **runnable** via `npm run explore:dtu` (see
[`docs/exploratory-agent.md`](../../docs/exploratory-agent.md) for the full
reference, including the CI workflow and session-brief format).

### Quick start (manual)

```bash
npm run explore:dtu   # dtu:up + dtu:seed + adapter + app + probing prompt
```

The script blocks after printing the probing prompt, keeping the background
servers alive. Press **Ctrl-C** to stop. Use `EXPLORE_SKIP_DTU=1` when the DTU
is already running.

### The loop

1. **Bring the universe up** — `npm run explore:dtu` (or the scheduled
   `.github/workflows/explore-dtu.yml`) stages the DTU and emits a
   _session brief_ (probing prompt + endpoint URLs).
2. **Launch an exploratory session** — the orchestrator reads the brief and
   kicks off an agent session with a prompt like:
   > "A live kbexplorer DTU is running: app at `http://localhost:4319`,
   > GitHub→Gitea adapter at `http://localhost:3456`, Gitea at
   > `http://localhost:3000`. Use the actors in `twins/gitea/actors/` (or
   > `npm run dtu:tea --`) to mutate issues/PRs, then verify the app reflects
   > each change on refresh. Probe edge cases (rapid edits, label churn,
   > concurrent PRs, merge races). For any gap you find, **author a new
   > `e2e/gitea/*.spec.ts`** that reproduces it and open a PR."
3. **Findings → specs land via human-reviewed PRs.** Agent-authored specs are
   never auto-committed to `main`; they go through normal review. Keep
   assertions in the specs, never in the twin (the **holdout rule** — see
   `DTU.md`).

### Boundary: harness vs. agent session

`explore-dtu.mjs` **does not call any LLM**. It stages the environment and
emits the brief; the orchestrator launches the agent session externally. This
boundary is intentional — the harness is infrastructure, not an actor.

## Constraints honoured

- **Podman only**, never Docker.
- **Zero secrets in the browser** — the admin token lives only in gitignored
  `.dtu/state.json` + process env, and only the server-side adapter ever uses it.
- **Purely additive** — the static twin and the fast e2e gate are untouched; this
  path is opt-in (`test:e2e:gitea`, `dtu:*`).
