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

Three themes via FluentProvider: dark (`webDarkTheme`), light (`webLightTheme`), sepia (custom `createLightTheme` with amber brand ramp).

## Validation Strategy
This project uses a Digital Twin Universe (DTU) for integration testing.
Before building or evolving any feature that touches an external service, read `DTU.md`.
