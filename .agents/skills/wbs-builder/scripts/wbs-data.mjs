// WBS definition for the KBX Template 4 canvas foundation workstream.

export const REPOS = {
  primary: { owner: 'anokye-labs', name: 'kbexplorer-template' },
};

export const KIND_TYPE_NAMES = {
  epic: 'Epic',
  feature: 'Feature',
  task: 'Task',
  bug: 'Bug',
};

const task = (parent, scope, validation, evidence) => [
  `**Parent feature:** ${parent}`,
  '',
  '## Scope',
  scope.trim(),
  '',
  '## Validation criteria',
  validation.trim(),
  '',
  '## Evidence-based completion criteria',
  evidence.map((e) => `- [ ] ${e}`).join('\n'),
].join('\n');

export const ITEMS = [
  {
    key: 'E-template4',
    kind: 'epic',
    repo: 'primary',
    parent: null,
    scheduled: true,
    title: 'Epic: Add Template 4 KBX Copilot Canvas foundation',
    body: `## What
Add a reusable Copilot Canvas extension foundation for KBX that is intentionally independent from the current three web-template proof and designed to support a future DAG/issue-graph variant without coupling to the current Issue DAG implementation.

## Why
This work is additive to the existing multi-template proof in #553. It creates a separate Template 4 workstream that can later replace the coordinator's current Issue DAG canvas while preserving the independent three-web-template presentation work as the baseline proof.

## Adopted model / approach
- Use the official project-scoped Copilot Canvas extension model (\`createCanvas\` / \`joinSession\`).
- Keep the foundation generic: provider wiring, render assets, data contracts, and example fixtures are separate from future DAG-specific behavior.
- Bind the HTTP bridge to 127.0.0.1 on an ephemeral port only.
- Store durable state by stable artifact identity, not panel \`instanceId\`.

## Scope boundaries
- In: reusable canvas shell, generic contract layer, extension docs/tests, validation path, authoring guidance, and the first DAG-variant work item.
- Out: shipping a concrete Issue DAG renderer or replacing the current coordinator DAG in this stage.

## Success definition
The repo contains a reusable canvas foundation that can be extended for later DAG variants and is documented with a clear migration path and validation evidence.

## Children
Features F-template4-shell and F-template4-contracts below. Related to #553, which remains the independent three-web-template proof.`
  },
  {
    key: 'F-template4-shell',
    kind: 'feature',
    repo: 'primary',
    parent: 'E-template4',
    scheduled: true,
    title: 'Feature: Scaffold the reusable KBX canvas extension shell',
    body: `**Parent epic:** E-template4 — Add Template 4 KBX Copilot Canvas foundation

## What
Build the project-scoped Copilot Canvas extension foundation, including the provider entry, renderer shell, local HTTP bridge, state model, and generic actions.

## Why
This is the reusable container that later DAG variants can mount without re-implementing the canvas plumbing or reusing the current coordinator Issue DAG assumptions.

## Scope
- Create the extension and canvas registration under \`.github/extensions/<name>/\`.
- Support viewport-safe responsive layout, loading/empty/error states, theme tokens, keyboard accessibility, and safe link handling.
- Keep live updates and data ingestion behind a generic contract boundary.

## Acceptance
- The shell opens as a reusable canvas and supports actions/state updates without coupling to a specific DAG or issue model.
- The provider wiring and renderer shell are separate and documented for future variants.`
  },
  {
    key: 'F-template4-contracts',
    kind: 'feature',
    repo: 'primary',
    parent: 'E-template4',
    scheduled: true,
    title: 'Feature: Enforce generic contracts and provider behavior with tests/docs',
    body: `**Parent epic:** E-template4 — Add Template 4 KBX Copilot Canvas foundation

## What
Add the generic data/state contract, focused automated tests, and authoring docs that explain how a later DAG variant should plug into the foundation.

## Why
The foundation must be reusable, idempotent, and independently testable before any later DAG implementation replaces the coordinator canvas.

## Scope
- Add focused generic contract and provider tests.
- Validate reload/rehydration behavior and live update semantics.
- Record the authoring pattern and a future DAG variant work item with acceptance criteria.

## Acceptance
- A follow-on DAG variant can implement the data contract and renderer without editing the foundation internals.
- The generic contracts and authoring docs clearly state durable identity, live updates, safe links, and migration parity expectations.`
  },
  {
    key: 'T-template4-shell-1',
    kind: 'task',
    repo: 'primary',
    parent: 'F-template4-shell',
    scheduled: true,
    title: 'Task: Add the project-scoped Copilot Canvas extension skeleton and HTTP bridge',
    body: task(
      'F-template4-shell — Scaffold the reusable KBX canvas extension shell',
      `Create the extension directory and \`extension.mjs\` entry using the official Copilot SDK \`createCanvas\` / \`joinSession\` pattern. Add a local HTTP-only bridge bound to 127.0.0.1 on an ephemeral port, keep console output off the stdout JSON-RPC channel, and separate the provider wiring from any renderer or issue-specific logic.`,
      `The extension loads, the canvas is discoverable to the host, and the local HTTP endpoints and actions respond correctly without leaking public network bindings or stdout logs.`,
      [
        'Extension loads under the project-scoped `.github/extensions/` layout',
        'HTTP server binds only to 127.0.0.1 on a dynamic port',
        'Canvas actions are registered via the official SDK contract',
      ]
    )
  },
  {
    key: 'T-template4-shell-2',
    kind: 'task',
    repo: 'primary',
    parent: 'F-template4-shell',
    scheduled: true,
    title: 'Task: Implement the generic renderer, state model, and live-update shell',
    body: task(
      'F-template4-shell — Scaffold the reusable KBX canvas extension shell',
      `Implement the generic state/data contract, renderer shell, loading/error/empty flows, theme token integration, keyboard accessibility, responsive sizing without pixel-based layout rules, and an SSE- or event-driven live update path that remains independent of the current Issue DAG.`,
      `A generic canvas template renders cleanly in the host, handles reload/rehydration idempotently, respects theme tokens, and updates from live event streams without requiring engine imports or Issue DAG coupling.`,
      [
        'Renderer handles empty/loading/error states',
        'Stable artifact identity rehydrates state without duplication',
        'Theme tokens and keyboard accessibility are verified in the foundation shell',
      ]
    )
  },
  {
    key: 'T-template4-contracts-1',
    kind: 'task',
    repo: 'primary',
    parent: 'F-template4-contracts',
    scheduled: true,
    title: 'Task: Add focused generic contract and provider tests',
    body: task(
      'F-template4-contracts — Enforce generic contracts and provider behavior with tests/docs',
      `Add automated tests for the generic state contract, provider actions, rehydration/idempotency semantics, and the local HTTP route behavior while keeping the tests intentionally generic and not coupled to the current Issue DAG.`,
      `The focused tests pass and cover the provider/state contract, idempotent reload/rehydration, and action validation paths with no Engine or DAG coupling.`,
      [
        'Generic provider contract tests pass',
        'Reload and rehydration tests confirm stable identity semantics',
        'Validation path is runnable in the repo',
      ]
    )
  },
  {
    key: 'T-template4-contracts-2',
    kind: 'task',
    repo: 'primary',
    parent: 'F-template4-contracts',
    scheduled: true,
    title: 'Task: Document the reusable authoring pattern and future DAG migration plan',
    body: task(
      'F-template4-contracts — Enforce generic contracts and provider behavior with tests/docs',
      `Write concise architecture and authoring docs explaining how to create a future DAG variant, how to keep the foundation generic, and how to preserve migration parity with the existing Issue DAG. Include a future work item with acceptance criteria covering prerequisite→dependent edges, blocked/active/done states, live refresh, durable data, explicit URLs, and migration parity.`,
      `A new author can create a variant without reading the current Issue DAG internals, and the documentation explicitly covers the future DAG replacement work and acceptance criteria.`,
      [
        'Authoring docs explain the extension structure and variant contract',
        'Future DAG variant work item is recorded with explicit acceptance criteria',
        'Docs explain migration parity with the current Issue DAG and limits of the foundation',
      ]
    )
  },
];

export const DEPS = [
  ['F-template4-contracts', 'F-template4-shell'],
  ['T-template4-shell-2', 'T-template4-shell-1'],
  ['T-template4-contracts-1', 'T-template4-shell-2'],
  ['T-template4-contracts-2', 'T-template4-contracts-1'],
];
