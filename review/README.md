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
- **3 themes**: `dark`, `light`, `sepia`
- **2 viewports**: `1440×900` (desktop), `390×844` (mobile)

Total: up to **54 screenshots** per run.

## File naming

```
<view>--<theme>--<viewport>.png
```

Examples:
- `reading--dark--desktop.png`
- `hud-expanded--sepia--mobile.png`

## Running the capture

```sh
# 1. Build the app (generates manifest + dist/)
npm run build

# 2. Run the capture
npm run capture:review
```

Output is written to `review/screenshots/` (gitignored — screenshots are review
artifacts, not committed fixtures).

After the run a `review/capture-report.json` file is created listing every
surface as `captured`, `skipped` (with reason), or `error`.

## Extending the surface set

Edit `scripts/review-surfaces.json` to add or remove surfaces. Each entry supports:

```json
{
  "id": "unique-id",
  "label": "Human-readable label",
  "url": "/#/route",
  "setup": { "localStorage": { "kbe-hud-dock": "left" } },
  "waitFor": ".css-selector",
  "action": "open-map | select-node | open-source-editor | null",
  "settleMs": 2000,
  "skipIfNotFound": false
}
```

## CI usage

The capture script exits non-zero if zero screenshots were captured. A CI step can
upload `review/screenshots/` as an artifact and `review/capture-report.json` as a
summary for async design review.
