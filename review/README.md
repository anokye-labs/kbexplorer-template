# Design Review — Canonical Screenshot Capture

This directory contains the review infrastructure for kbexplorer (issue #240).

## What is captured

The capture script (`scripts/capture-review.mjs`) boots the app against its own pre-built content and takes screenshots of the full surface set defined in `scripts/review-surfaces.json`:

| Surface | Description |
|---------|-------------|
| `home` | Home / landing page |
| `constellation` | Constellation graph (MAP overlay open) |
| `reading` | Reading view on a long-form node |
| `overview` | Overview / card grid |
| `hud-expanded` | HUD bar expanded (bottom dock) |
| `hud-collapsed` | HUD bar collapsed |
| `hud-docked-left` | HUD sidebar docked left |
| `node-selected` | Node selected — neighbourhood emphasis |
| `source-editor` | Source editor dialog (skipped if not present) |

Each surface is captured across:
- **4 themes**: `dark`, `light`, `sepia`, `ocean`
- **2 viewports**: `1440×900` (desktop), `390×844` (mobile)

Total: up to **72 screenshots** per run.

## File naming

```
<view>--<theme>--<viewport>.png
```

Examples:
- `reading--dark--desktop.png`
- `hud-expanded--sepia--mobile.png`

## Running the capture

```sh
# Builds local-mode manifest + dist, boots a preview server, captures all
# surfaces. Pass --skip-build to reuse an existing dist/ for fast re-runs.
npm run capture:review
```

Output is written to `review/screenshots/` (gitignored — screenshots are review
artifacts, not committed fixtures).

After the run a `review/capture-report.json` file is created listing every
surface. Each entry records `surfaceId`, `surfaceLabel`, `theme`, `viewport`,
`filename`, `status` (`captured`, `skipped`, `warning`, or `error`),
`skipReason`, and `error`. It deliberately omits the screenshot `bytes` size —
that value varied run-to-run and produced spurious merge conflicts in the
committed report.

## Extending the surface set

Edit `scripts/review-surfaces.json` to add or remove surfaces. Each entry supports:

```json
{
  "id": "unique-id",
  "label": "Human-readable label",
  "url": "/#/route",
  "setup": { "localStorage": { "kbe-hud-dock": "left" } },
  "waitFor": ".css-selector",
  "action": "open-map",
  "settleMs": 2000,
  "skipIfNotFound": false
}
```

## Visual-regression gate (issue #257)

The regression gate compares fresh captures against **committed baseline PNGs**
stored in `review/baselines/`. It uses [pixelmatch](https://github.com/mapbox/pixelmatch)
for perceptual pixel diffing.

### Diff approach

| Decision | Choice | Rationale |
|---|---|---|
| Tool | `pixelmatch` + `pngjs` | Pixel-level diff with anti-aliasing tolerance; produces a diff PNG you can open and inspect. Hash-only approaches (pHash/dHash) are compact but lose the diff image. |
| Baselines | Committed PNGs in `review/baselines/` | ~14 MB total (72 images × ~100–200 KB). Acceptable repo weight; gives reviewers an exact reference. |
| Tolerance | `threshold: 0.1` per channel | Allows sub-pixel anti-aliasing variance between local and CI font rendering while catching real layout/color shifts. |
| Fail gate | `> 0.5%` differing pixels | Catches layout shifts and color regressions; ignores minor AA and compression variance. |

Diff images are written to `review/diffs/` (gitignored) and uploaded as CI artifacts.

### Running the gate

```sh
# Full end-to-end: build → capture → diff
npm run capture:review     # builds + captures
npm run verify:visual      # diffs screenshots vs review/baselines/

# Or skip the build if dist/ is already current
npm run capture:review -- --skip-build
npm run verify:visual
```

The `verify:visual` script exits 0 (pass) or 1 (fail). On failure it prints
the offending surfaces and their diff percentages, and writes a report to
`review/visual-diff-report.json`.

### Bootstrapping baselines

Run this once (or after an intentional design change) to seed the committed
reference images:

```sh
npm run capture:review -- --update-baselines
git add review/baselines
git commit -m "chore(review): update visual baselines"
```

The `--update-baselines` flag copies every freshly-captured screenshot into
`review/baselines/`. Commit those PNGs; the gate will compare against them on
the next run.

### Where the gate runs

**NOT the fast PR gate.** The visual regression workflow
(`.github/workflows/visual-regression.yml`) uses
`workflow_dispatch` + a nightly schedule (05:15 UTC), mirroring the DTU
opt-in model. It is never wired into `github-pages.yml` or `playwright.config.ts`.

Reasons it is not a PR gate:
1. Captures need a full build + a real browser (~4–5 min).
2. Screenshots are environment-sensitive (font rendering, GPU compositing) — a
   CI baseline captured on Ubuntu may not match a macOS developer's run.
3. Intentional design changes require updating baselines; that step is a
   deliberate commit, not something that should auto-update on every PR.

Run manually with **workflow_dispatch** when you land a visual-touching change
and want to verify no unintended drift occurred.

## CI usage

The capture script exits non-zero if zero screenshots were captured. A CI step can
upload `review/screenshots/` as an artifact and `review/capture-report.json` as a
summary for async design review. See `.github/workflows/visual-regression.yml` for
the full nightly workflow.
