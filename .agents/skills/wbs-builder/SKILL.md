---
name: wbs-builder
description: >-
  This skill should be used when the user asks to "create a WBS",
  "create a work breakdown structure", "break this epic into issues",
  "scaffold GitHub issues", "create epics, features and tasks",
  "set up the issue hierarchy", "plan this program in GitHub",
  "create the Epic → Feature → Task hierarchy", or wants real GitHub issues
  with native issue TYPES, parent/child sub-issues, and blocked-by dependency
  edges created via the GraphQL API before implementation begins. Provides a
  resumable runner plus authoring conventions for materializing a typed,
  dependency-aware work-breakdown structure across one or more repos.
version: 0.1.0
---

# wbs-builder — GitHub Work-Breakdown Structure builder

Materialize an **Epic → Feature → Task** hierarchy as *real* GitHub issues —
with native issue **types**, parent/child **sub-issues**, and **blocked-by**
dependency edges — via the GitHub GraphQL API, **before any implementation
begins**. The output is a typed, navigable, dependency-aware backlog that maps
cleanly onto parallel work (e.g. one child session per Feature).

Use this when a program is large, parallelizable, or spans repos and you want
the plan modeled as *typed issues with structure*, not labels or title-tags.

## What you get

- **Native issue types** (Epic / Feature / Task / Bug) via `createIssue(issueTypeId)`,
  not labels.
- **Sub-issue tree** (Epic ⊃ Feature ⊃ Task) via `addSubIssue` — the real
  parent/child relationship GitHub renders in the issue UI.
- **Dependency edges** (`blocked-by` / `blocking`) via `addBlockedBy`, including
  best-effort **cross-repo** edges with a prose-link fallback.
- A **resumable** run: every created issue + link is journaled to `wbs-map.json`,
  so re-running any phase skips completed work.

## The hierarchy model

| Level | Issue type | Purpose | Body shape |
| --- | --- | --- | --- |
| **Epic** | Epic | The "north star" outcome for a program | What / Why / Adopted model / Scope boundaries / Success definition / Children |
| **Feature** | Feature | One ownable slice (≈ a PR or a focused session) | Parent epic / What / Why / Scope / Acceptance |
| **Task** | Task | One concrete change | Parent feature / **Scope** / **Validation criteria** / **Evidence-based completion criteria** |

Every **Task** must carry *evidence-based* completion criteria — named, checkable
proof (a passing test name, a screenshot, a build-log line, a readback) — so
"done" is never a judgment call. See `references/wbs-authoring.md` for full body
templates and the metadata model.

## ⚠️ Never assume the org — discover IDs at runtime

Issue-type node IDs are **org-scoped**: they differ per organization, may be
renamed/customized, and **user-owned repos may have none at all**. This skill's
runner **discovers** repository IDs and issue-type IDs fresh, per `owner/repo`,
by **name** — and refuses to run if a required type is missing (telling you what
it found). **Never hardcode a node ID copied from another org.** If a target repo
has no issue types, stop and ask the user to enable/define them in org settings
(or adjust `KIND_TYPE_NAMES` to match the org's actual type names) before
proceeding.

## How to use

1. **Author the WBS.** Copy `scripts/wbs-data.example.mjs` to
   `scripts/wbs-data.mjs` and fill in:
   - `REPOS` — logical keys → `{ owner, name }` (one or many; cross-repo OK).
   - `KIND_TYPE_NAMES` — map `epic/feature/task/bug` to the org's actual type names.
   - `ITEMS` — the Epics/Features/Tasks (each with `key`, `kind`, `repo`,
     `parent`, `title`, `body`). Use the `task()` helper for task bodies.
   - `DEPS` — `[key, blockedByKey]` blocked-by edges.

2. **Preflight (no writes).** Confirm the runner can see every repo and resolve
   every required type:
   ```bash
   cd .agents/skills/wbs-builder/scripts
   node create-wbs.mjs discover
   node create-wbs.mjs all --dry-run   # full plan, mutates nothing
   ```

3. **Create.** Run the three phases (or `all`). Each is idempotent + resumable:
   ```bash
   node create-wbs.mjs create   # issues with type + body
   node create-wbs.mjs sub      # parent → child sub-issue links
   node create-wbs.mjs deps     # blocked-by dependency edges
   ```
   Results are journaled to `wbs-map.json` (key → `{id, number, url}`). Re-run any
   phase safely; completed work is skipped.

Auth: the runner uses `$GITHUB_TOKEN` / `$GH_TOKEN`, else `gh auth token`. A
classic **`repo`** scope (or fine-grained Issues: read & write) is enough — issue
types, sub-issues, and dependencies do **not** need `read:org`.

## Files

- `scripts/create-wbs.mjs` — the resumable runner (`discover|create|sub|deps|all`,
  `--dry-run`, `--data`, `--map`). No hardcoded IDs; discovers everything.
- `scripts/wbs-data.example.mjs` — copy → `wbs-data.mjs`; the WBS definition
  (REPOS / KIND_TYPE_NAMES / ITEMS / DEPS) + the `task()` body helper.
- `references/wbs-authoring.md` — full guide: hierarchy + body templates, the
  native-metadata model, GraphQL mechanics, per-owner discovery rules, and
  idempotent execution discipline.

## Notes

- `wbs-data.mjs` and `wbs-map.json` are *your program's* data — generate them per
  use; don't commit another program's WBS back into the skill.
- Cross-repo `addSubIssue` / `addBlockedBy` may be rejected by GitHub; the runner
  records the failure so you can add a prose **"Relates to `owner/repo#N`"** link
  to the issue body instead (no loss of traceability).
