# KBX Canvas Foundation

This extension is the reusable Stage 1 foundation for Template 4. It is intentionally generic and is not coupled to the repo's current Issue DAG or the engine internals.

## Architecture

- `extension.mjs` — entry point that installs the canvas and wires it to the Copilot SDK `createCanvas` / `joinSession` model.
- `src/contracts.mjs` — durable artifact contract and state normalization helpers. The `artifactId` is the durable identity; `instanceId` stays panel-scoped and transient.
- `src/provider.mjs` — action metadata and canvas-provider behavior, including schema validation and rehydration rules.
- `src/http-server.mjs` — local bridge bound to `127.0.0.1` on an ephemeral port. It exposes the HTML renderer and SSE state feed.
- `src/renderer.mjs` — HTML/CSS/JS shell for generic canvas rendering, theme support, empty/loading/error states, and safe link handling.
- `fixtures/example-kbx-state.mjs` — sample seed state for tests and future variant authoring.

## Authoring a derived variant

1. Reuse the existing `artifactId`-based contract and keep durable data separate from panel `instanceId`.
2. Create a new variant provider that extends the generic action schema rather than importing engine internals.
3. Swap the renderer or presenter shell for the variant-specific graph, but keep the shared state model and SSE bridge.
4. Ensure every action is validated against JSON schema before mutating durable state.
5. Keep the variant generic enough to survive reloads, remounts, and multiple panel instances without data loss.

## Future DAG variant work item

Title: `Template 4 DAG variant: replace the coordinator issue DAG canvas`

Acceptance criteria:
- The variant reads and writes a durable artifact state keyed by stable item identifiers.
- `prerequisite -> dependent` edges are rendered clearly and update in real time via SSE or equivalent live refresh.
- Items expose `blocked`, `active`, and `done` states, with explicit URLs and metadata.
- The variant rehydrates the same durable state after reload without creating a second artifact or losing edges.
- The historical Issue DAG remains available as a reference while the new variant matches its migration semantics.
- The variant surfaces explicit safe links, keyboard focusability, and responsive layout without pixel sizing.
- The provider contract remains generic and decoupled from the current session DAC / issue DAG shell.

## Validation path

- Unit tests: `node --test tests/kbx-canvas-foundation.test.mjs`
- Browser validation: `npx playwright test e2e/kbx-canvas-foundation.spec.ts --project=chromium --reporter=line`
- If Playwright cannot run in the environment, document the exact limitation and keep the test in the repo for CI.
