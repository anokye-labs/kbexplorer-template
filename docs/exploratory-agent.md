# Exploratory-agent harness

This document describes the **exploratory-agent loop**: how a scheduled or
manually triggered harness stages the Digital Twin Universe (DTU), emits a
session brief, and enables an orchestrator to launch agent sessions that probe
edge cases and propose new `e2e/gitea/*.spec.ts` specs for human review.

This formalizes the [Exploratory-agent playbook][playbook] section in
`twins/gitea/README.md` into a runnable, schedulable harness.

[playbook]: ../twins/gitea/README.md#exploratory-agent-playbook

---

## The loop

```
 ┌────────────────────────────────────────────────────────────┐
 │  1. Harness (explore-dtu.mjs / explore-dtu.yml)            │
 │     • npm run dtu:up  → Podman machine + Gitea container    │
 │     • npm run dtu:seed → snapshot working tree to twin      │
 │     • start adapter   → GitHub→Gitea proxy on :3456        │
 │     • start app       → Vite on :4319 (VITE_GH_API_BASE)   │
 │     • emit session-brief.json + job summary                 │
 └───────────────────────┬────────────────────────────────────┘
                         │  brief (endpoints + probing prompt)
                         ▼
 ┌────────────────────────────────────────────────────────────┐
 │  2. Orchestrator reads the brief                           │
 │     (human, CI caller, scheduled agent runtime)            │
 │     • creates an agent session with the probing prompt     │
 └───────────────────────┬────────────────────────────────────┘
                         │  agent session drives actors
                         ▼
 ┌────────────────────────────────────────────────────────────┐
 │  3. Agent session probes the live DTU                      │
 │     • calls actors in twins/gitea/actors/ to mutate        │
 │     • verifies the app reflects changes on refresh         │
 │     • probes edge cases (rapid edits, concurrent PRs, …)   │
 └───────────────────────┬────────────────────────────────────┘
                         │  gap found
                         ▼
 ┌────────────────────────────────────────────────────────────┐
 │  4. Gap → spec PR (human-reviewed, never auto-committed)   │
 │     • agent authors e2e/gitea/<new-scenario>.spec.ts       │
 │     • opens a PR for human review                          │
 │     • PR merged → spec joins the nightly DTU suite         │
 └────────────────────────────────────────────────────────────┘
```

### The holdout rule

Assertions live **in `e2e/gitea/` specs only** — never inside the twin itself.
The twin translates faithfully (GitHub REST ↔ Gitea API); the specs measure
the real app behaviour.  Agent-authored specs land through **normal
human-reviewed PRs** — they are never auto-committed to `main`.

See [`DTU.md`](../DTU.md) for the full holdout discipline.

---

## Running locally

```bash
# Full bringup (requires Podman):
npm run explore:dtu

# DTU already running — skip dtu:up/seed:
EXPLORE_SKIP_DTU=1 npm run explore:dtu

# Adapter only (no Vite app):
EXPLORE_NO_APP=1 npm run explore:dtu

# Write session brief to .dtu/session-brief.json:
EXPLORE_WRITE_BRIEF=1 npm run explore:dtu
```

The script blocks after printing the probing prompt, keeping the background
servers alive. Press **Ctrl-C** to stop them.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPLORE_SKIP_DTU` | — | Skip `dtu:up` + `dtu:seed` (DTU already running) |
| `EXPLORE_NO_APP` | — | Skip the Vite app step |
| `EXPLORE_WRITE_BRIEF` | — | Write `.dtu/session-brief.json` |
| `EXPLORE_ADAPTER_PORT` | `3456` | Override adapter port |
| `EXPLORE_APP_PORT` | `4319` | Override app port |
| `TWIN_PORT` | `3456` | Adapter port (used by the adapter itself) |
| `GITEA_HTTP_PORT` | `3000` | Gitea container host port |

All `GITEA_*` / `KB_*` variables from `twins/gitea/README.md` are also honoured.

### Podman boundary

`dtu:up` requires **Podman** (not Docker). On macOS and Windows a Podman
machine must be installed (`podman machine init && podman machine start`).
On `ubuntu-latest` (GitHub Actions) Podman is available natively — no machine
step needed (bootstrap detects this automatically).

If Podman is unavailable, set `EXPLORE_SKIP_DTU=1` and point the harness at a
manually-started DTU. The session brief is still emitted with whatever
readiness state the adapter and app report.

---

## CI workflow

**`.github/workflows/explore-dtu.yml`** — opt-in, never on the PR gate:

| Trigger | Schedule |
|---------|----------|
| `workflow_dispatch` | Manual run (with optional `skip_app` + `write_brief` inputs) |
| `schedule` | Nightly, 06:00 UTC |

The job:
1. Installs dependencies (no `vite build` — the harness serves the app with
   `vite dev`, the only mode that honours the runtime `VITE_GH_API_BASE`).
2. Runs `node scripts/explore-dtu.mjs` (which does `dtu:up` + `dtu:seed` +
   starts the adapter + app, writes the brief, and emits a job summary).
3. Uploads `.dtu/session-brief.json` as a workflow artifact
   (`explore-dtu-brief-<run-id>`).
4. Tears down the container (`dtu:down`).

The harness blocks for up to 5 minutes after printing the brief so that a
connected orchestrator could in principle launch a session against the live
endpoints.  In the absence of an external consumer the job completes normally
when `timeout` fires.

> **Not wired to:** the PR gate (`github-pages.yml`), the nightly DTU scenario
> suite (`dtu-gitea.yml`), or any auto-merge step.

---

## Session brief format (`.dtu/session-brief.json`)

```jsonc
{
  "generatedAt": "2026-06-13T06:00:00.000Z",
  "endpoints": {
    "app":     "http://localhost:4319",   // null when EXPLORE_NO_APP=1
    "adapter": "http://localhost:3456",
    "gitea":   "http://localhost:3000"
  },
  "ready": {
    "adapter": true,
    "app":     true    // null when EXPLORE_NO_APP=1
  },
  "repo": { "owner": "anokye-labs", "repo": "kbexplorer-template", "branch": "main" },
  "actorsDir": "twins/gitea/actors/",
  "specsDir":  "e2e/gitea/",
  "holdoutRule": "…",
  "probingPrompt": "…"   // ready-to-paste prompt for the agent session
}
```

---

## Actor reference

Actors drive the twin via Gitea's REST API. Use them in probing sessions or
import them from Playwright specs:

```bash
# Open a new issue (appears as a work node on refresh):
node twins/gitea/actors/open-issue.mjs --title "Probe: …" --label bug

# Edit a source file + open a PR:
node twins/gitea/actors/edit-source.mjs \
  --path content-model/people/ben.yaml --set title="Staff Engineer"

# Cut a release (bumps version tag + creates release):
node twins/gitea/actors/cut-release.mjs --tag v1.99.0

# Merge a PR:
node twins/gitea/actors/merge-pr.mjs --number <N> --style merge

# Interactive tea shell (Gitea's gh analogue):
npm run dtu:tea -- issues ls
npm run dtu:tea -- pr ls
```

Full actor documentation: [`twins/gitea/README.md#actors`](../twins/gitea/README.md#actors).

---

## Spec authoring guidelines (for agent-written PRs)

When the agent finds a gap and proposes a new spec:

1. **File location:** `e2e/gitea/<scenario-name>.spec.ts`
2. **Imports:** use existing actor helpers (`openIssue`, `editSource`, etc.)
   from `twins/gitea/actors/` — do not duplicate HTTP calls inline.
3. **Assertions in the spec, not the twin.** Do NOT modify `adapter.mjs`,
   `seed.mjs`, or any file under `twins/` to make an assertion pass.
4. **Unique, nonce'd titles** for actor-created entities so runs accumulate
   harmlessly against a warm twin.
5. **Deterministic teardown** — the spec should clean up (close/delete) what
   it creates, or use `test.afterEach`.
6. **PR title convention:** `test(gitea): <what the spec proves>`

See [`e2e/gitea/`](../e2e/gitea/) for existing spec examples.
