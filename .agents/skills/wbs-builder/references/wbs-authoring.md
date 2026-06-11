# WBS authoring guide

This is the full reference for building a typed, dependency-aware
**Epic → Feature → Task** work-breakdown structure in GitHub, before any
implementation begins. It is also the prompt you can hand to another agent: it
covers *what* to create, *how to author* the work items, the *native metadata
model*, the *GraphQL mechanics*, and the *execution discipline*.

---

## 1. The hierarchy model

Model the whole program as **typed GitHub issues** first, then fan out
implementation. Three levels:

- **Epic** — the north-star outcome. One per major program thread. Spans many
  Features and (often) more than one repo.
- **Feature** — one ownable slice, roughly a single PR or one focused work
  session. A child session can own a Feature end-to-end from its body alone.
- **Task** — one concrete change with an explicit validation gate and named
  evidence for "done".

Relationships are **native GitHub structure**, never labels or `[Epic]` title
prefixes:

- Epic ⊃ Feature ⊃ Task as **sub-issues** (`addSubIssue`).
- **blocked-by / blocking** dependency edges between issues (`addBlockedBy`),
  including cross-repo where allowed.
- Cross-repo Epic↔Epic and contract links via body references plus an attempted
  dependency edge.

---

## 2. Body-authoring conventions

Bodies are the durable spec. Write them so a reader needs nothing else.

### Epic body

```
## What
Current state → target state, concretely.

## Why
The forcing function / rationale (e.g. a source system is being sunset).

## Adopted model / approach
The key design decisions taken as given for the whole program.

## Scope boundaries
- In:  what this Epic owns.
- Out: deferred work — name the backlog Feature or sibling Epic that owns it.

## Success definition
The end-to-end, demoable acceptance bar.

## Children
List child Features. Link sibling Epics: "Relates to owner/repo#N".
```

### Feature body

```
**Parent epic:** E# — <title>

## What
The slice delivered (≈ one PR / one session).

## Why
Why it exists and what it unblocks.

## Scope
In-scope work; call out anything deliberately deferred to a backlog Feature.

## Acceptance
Observable criteria that make the Feature "done".

**Blocked by:** F# (mirror each GraphQL dependency edge in prose too).
```

### Task body — the most important shape

Every Task uses **Scope / Validation criteria / Evidence-based completion
criteria**. The `task()` helper in `wbs-data.example.mjs` emits exactly this:

```
**Parent feature:** F# — <title>

## Scope
Exactly what to change, and in which files / areas.

## Validation criteria
How correctness is judged — the gate (vitest / lint / build / Playwright / readback).

## Evidence-based completion criteria
- [ ] A concrete, checkable artifact that proves done (named passing test, screenshot,
      build-log line, a CACHE_VERSION diff, a rendered node, a GraphQL readback).
- [ ] A second proof item.
```

**No task is "done" without named evidence.** "Validation" is *how you test*;
"evidence" is *the artifact that proves it* — keep them distinct.

---

## 3. The native metadata model

Use GitHub's first-class fields, not conventions-on-top-of-text:

| Concept | Use | Do NOT use |
| --- | --- | --- |
| Epic / Feature / Task | native **issue type** (`issueTypeId`) | a `type:` label or title prefix |
| Parent / child | **sub-issue** (`addSubIssue`) | "Part of #12" prose only |
| Dependency | **blocked-by** (`addBlockedBy`) | a `blocked` label |
| Cross-repo link | body reference + attempted cross-repo edge | nothing |

Why: typed issues + sub-issues + dependencies render as real structure in the
GitHub UI, drive project boards/insights, and let a fan-out reliably compute "what
is unblocked now".

---

## 4. ⚠️ Discover all IDs in the TARGET repo/org first (MANDATORY)

**Do not assume the same org.** Issue-type node IDs are **org-scoped**:

- They differ between organizations.
- They can be renamed or customized per org.
- **User-owned repositories may have no issue types at all.**

So **before creating anything**, discover — per `owner/repo`, by **name**:

1. The **repository ID** (`repository.id`).
2. The **issue-type IDs** (`repository.issueTypes(first:50){ nodes{ id name } }`),
   matched to the type **names** the program uses.

The runner (`create-wbs.mjs`) does this in its `discover` phase and **throws** if
a required type name is absent — listing the names it did find. When that happens:

- **Stop and ask the user** to enable/define the issue types in the org's settings
  (Organization → Settings → Issue types), **or**
- adjust `KIND_TYPE_NAMES` in the data file to match the org's *actual* type names
  (e.g. some orgs use `Story` instead of `Feature`).

**Never** hardcode a node ID copied from another org/program — it will silently
target the wrong type or fail. Every ID in this skill is resolved at runtime.

---

## 5. GraphQL mechanics (proven)

- Endpoint: `POST https://api.github.com/graphql`.
- **Required header on every request:**
  `GraphQL-Features: issue_types,sub_issues,issue_dependencies`.
  Without it, the type / sub-issue / dependency fields and mutations do not exist.
- Auth: a classic **`repo`** scope (or fine-grained Issues: read & write) is
  sufficient. `read:org` is **not** required for types/sub-issues/dependencies.

Discovery query:

```graphql
query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){
    id
    owner{ __typename login }          # User vs Organization
    issueTypes(first:50){ nodes{ id name } }
  }
}
```

Mutations:

```graphql
# create with a native type
createIssue(input:{ repositoryId:$repo, title:$title, body:$body, issueTypeId:$type }){
  issue{ id number url }
}
# parent → child (issueId = parent, subIssueId = child)
addSubIssue(input:{ issueId:$parent, subIssueId:$child }){ issue{ number } }
# dependency (issueId is BLOCKED; blockingIssueId BLOCKS it)
addBlockedBy(input:{ issueId:$issue, blockingIssueId:$by }){ issue{ number } }
```

Read dependencies back via `Issue.blockedBy` / `Issue.blocking` to verify.

**Creation order per node:** `createIssue` (with `issueTypeId`) → capture
`id`/`number` → link sub-issues → wire `addBlockedBy` once *both* endpoints exist.

---

## 6. Idempotent, resumable execution discipline

- **Journal everything.** After each create/link, persist
  `key → { id, number, url, parentLinked }` (and a `__deps` set) to
  `wbs-map.json`. The runner skips anything already recorded, so a re-run after a
  rate-limit, network blip, or partial failure resumes cleanly.
- **Phase the work:** `create` all issues first, then `sub` (needs both endpoints
  to exist), then `deps` (same). Running `all` does them in order.
- **Dry-run first.** `--dry-run` resolves IDs and prints the full plan without
  mutating, so you can eyeball the structure and catch a missing type early.
- **Cross-repo fallback.** `addSubIssue` / `addBlockedBy` across repos may be
  rejected. Record the rejection and add a prose **"Relates to `owner/repo#N`"**
  link to the body — traceability is preserved even when the native edge isn't
  allowed.
- **Verify with a readback.** After `deps`, query a sample issue's `blockedBy`
  to confirm edges materialized as intended.

---

## 7. After Stage 0

With the typed, linked backlog in place, fan out implementation: spin up one
child session per **unblocked** Feature (respecting the `blocked-by` graph), and
let each session use its Tasks' **evidence-based completion criteria** as the
definition of done. Nothing in Stage 0 writes implementation code — it only
creates issues and their metadata.
