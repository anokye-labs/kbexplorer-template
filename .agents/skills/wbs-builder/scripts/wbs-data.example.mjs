// ─────────────────────────────────────────────────────────────────────────────
// WBS DEFINITION (example / template).
//
// Copy this file to `wbs-data.mjs`, then replace REPOS + ITEMS + DEPS with your
// real program. `create-wbs.mjs` imports REPOS / KIND_TYPE_NAMES / ITEMS / DEPS
// from here and resolves every repository ID and (org-scoped) issue-type ID at
// runtime by NAME — so this file contains NO GitHub node IDs. Never hardcode IDs.
// ─────────────────────────────────────────────────────────────────────────────

// Logical repo keys → real owner/repo. Items reference these keys via `repo`.
// `owner` may be an organization or a user, but issue TYPES are an org-level
// feature: a user-owned repo will have none and the runner will refuse to run.
export const REPOS = {
  primary: { owner: 'your-org', name: 'your-repo' },
  // secondary: { owner: 'your-org', name: 'companion-repo' },  // cross-repo program
};

// Maps each `kind` used below to the issue TYPE NAME defined in the target org's
// settings. Adjust the right-hand values to match the org's actual type names
// (the runner errors out, listing what it found, if a name doesn't exist).
export const KIND_TYPE_NAMES = {
  epic: 'Epic',
  feature: 'Feature',
  task: 'Task',
  bug: 'Bug',
};

// Helper: every TASK body gets the same Scope / Validation / Evidence shape, so a
// task can be executed and closed without re-reading the plan. Evidence items are
// rendered as checkboxes.
const task = (parent, scope, validation, evidence) =>
  [
    `**Parent feature:** ${parent}`,
    ``,
    `## Scope`,
    scope.trim(),
    ``,
    `## Validation criteria`,
    validation.trim(),
    ``,
    `## Evidence-based completion criteria`,
    evidence.map((e) => `- [ ] ${e}`).join('\n'),
  ].join('\n');

// The full work-breakdown structure. Each item:
//   key       — stable WBS handle (used by DEPS + the resumable id map)
//   kind      — 'epic' | 'feature' | 'task' | 'bug' (mapped via KIND_TYPE_NAMES)
//   repo      — a key from REPOS
//   parent    — the parent item's `key` (null for an Epic). Drives sub-issue links.
//   scheduled — true = work it now; false = explicitly-tracked backlog (issue
//               created, but no work assigned). Informational; not sent to GitHub.
//   title     — issue title (prefix with the level for scannability)
//   body      — rich markdown (see references/wbs-authoring.md for templates)
export const ITEMS = [
  // ── EPIC ───────────────────────────────────────────────────────────────────
  {
    key: 'E1', kind: 'epic', repo: 'primary', parent: null, scheduled: true,
    title: 'Epic: <program-level outcome>',
    body: `## What
Current state → target state, concretely.

## Why
The forcing function / business or technical rationale.

## Adopted model / approach
Key design decisions taken as given for the whole program.

## Scope boundaries
- In: the work this Epic owns.
- Out: deferred work — name the backlog Feature (e.g. F3) or sibling Epic that owns it.

## Success definition
The end-to-end, demoable acceptance bar for the Epic.

## Children
Features F1–F2 below. Relates to \`your-org/companion-repo#NN\` (sibling Epic).`,
  },

  // ── FEATURES ─────────────────────────────────────────────────────────────────
  {
    key: 'F1', kind: 'feature', repo: 'primary', parent: 'E1', scheduled: true,
    title: 'Feature: <foundational slice>',
    body: `**Parent epic:** E1 — <program-level outcome>

## What
The slice delivered (≈ one PR / one focused work session).

## Why
Why it exists and what it unblocks.

## Scope
In-scope work; call out anything deliberately deferred.

## Acceptance
Observable criteria that make this Feature "done".`,
  },
  {
    key: 'F2', kind: 'feature', repo: 'primary', parent: 'E1', scheduled: true,
    title: 'Feature: <dependent slice>',
    body: `**Parent epic:** E1 — <program-level outcome>

## What
A slice that builds on F1.

## Why
Rationale / what it unblocks.

## Scope
In-scope work.

## Acceptance
Observable "done" criteria.

**Blocked by:** F1 (mirrors the GraphQL dependency edge in prose).`,
  },

  // ── TASKS ────────────────────────────────────────────────────────────────────
  {
    key: 'T1.1', kind: 'task', repo: 'primary', parent: 'F1', scheduled: true,
    title: 'Task: <concrete unit of work>',
    body: task(
      'F1 — <foundational slice>',
      `Exactly what to change, and in which files / areas.`,
      `How correctness is judged (the gate).`,
      [
        'Concrete, checkable proof item (e.g. unit test passes)',
        'Second proof item (e.g. command output / screenshot / readback)',
      ]
    ),
  },
  {
    key: 'T2.1', kind: 'task', repo: 'primary', parent: 'F2', scheduled: true,
    title: 'Task: <unit that depends on T1.1>',
    body: task(
      'F2 — <dependent slice>',
      `What to change.`,
      `Validation gate.`,
      ['Proof item one', 'Proof item two']
    ),
  },
];

// Blocked-by edges: [key, blockedByKey] — "key is blocked by blockedByKey".
// Feature-level edges gate fan-out; task-level edges sequence work within/across
// Features. Cross-repo edges are attempted, and on rejection the runner records
// the failure so you can add a prose "Relates to owner/repo#N" link instead.
export const DEPS = [
  ['F2', 'F1'],     // feature-level
  ['T2.1', 'T1.1'], // task-level
];
