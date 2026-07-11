# Agents — kbexplorer-template

## Stack

React 19 + TypeScript + Vite 8, `@fluentui/react-components` v9, `vis-network` for graph canvas, hosted on Azure Static Web Apps. Content fetched from GitHub API at runtime.

## Critical Rules

### No Pixels for Sizing

**Never use pixel values for layout dimensions.** Use viewport units (`vw`, `vh`), percentages, or Fluent tokens. Pixels don't scale across screen sizes. This applies to sidebar widths, content widths, padding, and any user-facing dimension. Borders (`1px solid`) are the only exception.

### Cache Versioning

**Bump `CACHE_VERSION` in `src/api/github.ts` whenever you change:**
- The shape or encoding of cached data (issues, README, tree)
- localStorage key names or value formats (e.g. sidebar width units)
- Content parsing logic that changes what nodes/edges are produced
- Any setting stored in localStorage (`kbe-*` keys)

Failing to bump the version means users with old cached data get broken renders that only clear with manual "Clear site data." This is a silent, hard-to-diagnose failure.

### Verify with Playwright Before Declaring Done

Always test with `playwright-cli` before telling the user something works. Test the **actual user flow**, not a clean-state shortcut:
- If the feature involves dock switching, test switching FROM the default state
- If data is cached, test with cached data present
- If a setting is persisted, test with that setting pre-set in localStorage
- Screenshot and check pixel counts on canvas elements

### Vite HMR is Unreliable

After structural changes (new files, moved exports, changed module boundaries), HMR frequently serves stale code. When behavior doesn't match expectations:
1. Kill the Vite process
2. Delete `node_modules/.vite`
3. Restart `npx vite`

The `$RefreshReg$ is not defined` error always means stale cache.

## Architecture Notes

### Thin Template, Fat Engine

This template repo contains **no data-pipeline or graph-domain logic**. Manifest generation, catalogue building, content derivation/enrichment, and graph validation/assessment all live in **`@anokye-labs/kbexplorer-engine`** and are invoked through the **`kbx`** CLI (`@anokye-labs/kbx`) — see `npm run prebuild` / `validate` / `validate:drift` / `assess` / `derive` / `compare` in `package.json`. `scripts/` in this repo holds only presentation, build, and test tooling: icon manifest generation, the Vite build wrapper, visual-regression capture/audit/verify, the runtime-graph black-box audit, and dev/test harnesses (DTU exploration, smoke tests, probes). If a task looks like it needs new graph/catalogue/manifest logic, it belongs upstream in the engine, not here.

### Single Canvas Principle

The HUD minimap uses one `<canvas ref={canvasRef}>` per dock orientation (vertical vs horizontal), rendered inside a shared wrapper. The `drawMinimap` function reads `canvasRef.current` — if the canvas unmounts and remounts (e.g. dock switch), the ref updates and the draw effect re-fires via `dock` in the dependency array.

### Graph Positions

`computeGraphPositions()` creates a hidden off-screen vis-network to compute force-directed layout, then calls back with a position map. Positions are stored in React state (`minimapPositions`) so that `drawMinimap` (via `useCallback` deps) re-creates when positions arrive.

### Content Modes

- **repo-aware** (default): Issues, README, directories from GitHub API. README auto-links to nodes it mentions by keyword/reference.
- **authored**: Markdown files with YAML frontmatter from a content directory.

### Themes

Three **built-in base modes** ship in code and are applied via `FluentProvider` (see `BUILTIN_MODES` / `BUILTIN_THEME_MAP` in `src/hooks/useTheme.ts`): dark (`webDarkTheme`), light (`webLightTheme`), and sepia (custom `createLightTheme` with an amber brand ramp). The names `dark`/`light`/`sepia` are reserved.

On top of those, the self-repo's content config adds **named theme variants** (features F2 / F5) that derive from a `base` (dark/light) plus a `brand` seed and/or explicit `tokens`, and join the `t`-key cycle (`modesForMap` lists built-ins first, then named themes):
- `ocean` (plus `rose`, `midnight`) — declared inline in `content/config.yaml` under `theme.themes`. `ocean` is then field-merged by the external file below (demonstrating F5 override precedence).
- `forest` and `sandstone` — introduced only by `content/themes/extra-themes.yaml`, referenced via `theme.themesFile` (F5 / T5.1) and fetched at runtime.

Because these named themes are part of the shipped config, the review / visual-regression surfaces (`scripts/review-surfaces.json`) deliberately cycle **dark / light / sepia / ocean** — the three built-ins plus the `ocean` named theme — so the captured baselines exercise the F2/F5 named-theme path, not just the built-in modes.

## Validation Strategy
This project uses a Digital Twin Universe (DTU) for integration testing.
Before building or evolving any feature that touches an external service, read `DTU.md`.

## Content Derivation
The content in `content/` is machine-derived from the repo's systems of record.
For the full evaluation pipeline (worktree experiment, quality assessment, comparison), read [`DERIVATION.md`](DERIVATION.md).

## GitHub & Work-Item Conventions

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contributor workflow (issue types, branch protection). The conventions below are the subset that matters most for an agent working across this repo and its sibling repos:

**GitHub interaction (tool-agnostic).** Interact with GitHub through whatever capability your runtime provides — `gh` CLI, REST/GraphQL, or an MCP server. No specific coding agent or tool is assumed; GraphQL-level capability is needed for issue types, sub-issues, and blocked-by relationships.

**Issue references: `refs #X`, not `closes #X`.** Closing an issue is a deliberate, separate step after verification confirms the work is done — never let a merge close an issue by keyword.

**Verification before close.** Before closing an issue: confirm the artifact is merged and gates are green; re-verify acceptance criteria against the CURRENT state of the system; then close, citing the evidence. Before starting an issue, verify its blocked-by dependencies are resolved — if blocked, comment and stop.

**Workback scheduling.** Model programs as Epic → Feature → Task using native sub-issues. Sequence in waves: independent items dispatch together; dependent items queue behind blocked-by edges; a parent completes only when all children complete. See `.agents/skills/wbs-builder/` for the operational mechanics.

**Commits.** Conventional Commits (`type(scope): description`), atomic. Never commit directly to the default branch; never force-push.

**Branch protection: check, don't assume.** Claims in this file about approval counts or required checks may be stale — verify the repo's live settings before relying on them.

## Skills

Repo-local skills live under `.agents/skills/`.

- **wbs-builder** ([`.agents/skills/wbs-builder/SKILL.md`](.agents/skills/wbs-builder/SKILL.md)) — when asked to plan a program in GitHub (e.g. "create a WBS", "break this epic into issues", "scaffold the Epic → Feature → Task hierarchy"), use this skill to materialize real GitHub issues with native issue **types**, parent/child **sub-issues**, and **blocked-by** dependency edges via the GraphQL API, before any implementation begins. It ships a resumable runner (`scripts/create-wbs.mjs`) and an authoring guide (`references/wbs-authoring.md`). **Issue-type IDs are org-scoped — the runner discovers repo and type IDs at runtime by name and never assumes another org's IDs.**
