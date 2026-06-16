# Digital Twin Universe (DTU)

> **Looking for the overall testing map?** See [TESTING.md](TESTING.md) for the full pyramid, CI orchestration table, and per-layer runbook. This document covers the DTU architecture and holdout discipline in detail.

## What this is
A DTU is a set of local behavioral clones of every external service this project
depends on. Instead of calling live services during development and testing, all
integration calls route to twins running locally.

## Why
- Run tests at any volume without rate limits, API costs, or flakiness
- Safely simulate failure modes (auth failures, timeouts, bad payloads)
- Validate agent-written code against realistic service behavior

## The holdout rule
Validation scenarios are stored separately from the codebase and treated like
an ML holdout set — they measure whether the implementation satisfies real user
needs. Do NOT write code that targets specific scenario assertions. Code to the
feature's intent; let scenarios evaluate you.

## Your responsibility when adding a feature
1. Check if `twins/` already covers the required API surface
2. If not, extend the twin before writing the feature code
3. Never call the live service directly during development or testing

## Two kinds of GitHub twin

This repo ships **two** twins for the GitHub API, on the same
`VITE_GH_API_BASE` seam — pick the one that matches what you are testing:

| Twin | Path | Backing | Use it for |
|------|------|---------|------------|
| **Static fixture** | `twins/github/` | Canned JSON, in-memory | The fast default e2e gate (`playwright.config.ts`). Deterministic, zero deps. |
| **Gitea live universe** | `twins/gitea/` | Real **Gitea** in a **Podman** container | Multi-agent workflows where issues/PRs/branches **mutate over time** and the app must reflect the changes on refresh. |

The fast gate keeps using the static twin. The Gitea harness is **additive and
opt-in** — it never runs in the default `npm test` / `npm run test:e2e` path.

## Gitea live twin — multi-agent harness (`twins/gitea/`)

A stateful **GitHub-REST → Gitea-API translation proxy** lets the unchanged app
talk to a real Gitea server. Many actors (scripted bots today, exploratory
Copilot sessions tomorrow) open and edit issues, push branches, and merge PRs;
the running app then reflects those mutations on refresh — including the
cache-TTL / ETag refresh contract.

```
actor (tea CLI / REST) ──▶ Gitea (Podman, SQLite)
                                  ▲
app ──GitHub REST──▶ adapter :3456/3557 ──Gitea API──┘
```

- **Runtime = Podman, not Docker.** The harness starts the Podman machine and
  runs a pinned `gitea/gitea` image. No Docker engine is involved.
- **Actor CLI = `tea`** (Gitea's `gh` analogue), auto-downloaded and cached under
  the gitignored `.dtu/bin/`. Scripted scenario actors use Gitea's REST API
  directly for speed; `tea` is the richer surface for interactive probing.
- **No secrets in the browser.** The admin token lives only in `.dtu/state.json`
  (gitignored) and process env, and only ever travels server-side through the
  adapter. The app/browser still holds nothing.

### Run it
```bash
npm run dtu:up          # Podman machine + Gitea container + admin token
npm run dtu:seed        # push the working tree to the twin + baseline issues/PRs
npm run dtu:twin        # serve the GitHub→Gitea adapter (VITE_GH_API_BASE target)
npm run test:e2e:gitea  # full scenario suite (bootstrap+seed run as globalSetup)
npm run dtu:down        # stop + remove the container
npm run dtu:reset       # down + purge .dtu/ state
```

See [`twins/gitea/README.md`](twins/gitea/README.md) for env vars, the actor
reference, and the **exploratory-agent playbook** (how the orchestrator launches
Copilot sessions against a running DTU to probe scenarios and author new specs).

### Holdout discipline for this harness
The scenario specs in `e2e/gitea/` are the holdout set: assertions live there,
never inside the twin. Do **not** teach the adapter to special-case a test —
translate GitHub↔Gitea faithfully and let the specs measure the real app.
Agent-authored specs land through normal **human-reviewed PRs**, never
auto-committed to `main`.
