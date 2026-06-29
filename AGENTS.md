# Agents — kbexplorer

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

## Skills

Repo-local skills live under `.agents/skills/`.

- **wbs-builder** ([`.agents/skills/wbs-builder/SKILL.md`](.agents/skills/wbs-builder/SKILL.md)) — when asked to plan a program in GitHub (e.g. "create a WBS", "break this epic into issues", "scaffold the Epic → Feature → Task hierarchy"), use this skill to materialize real GitHub issues with native issue **types**, parent/child **sub-issues**, and **blocked-by** dependency edges via the GraphQL API, before any implementation begins. It ships a resumable runner (`scripts/create-wbs.mjs`) and an authoring guide (`references/wbs-authoring.md`). **Issue-type IDs are org-scoped — the runner discovers repo and type IDs at runtime by name and never assumes another org's IDs.**
