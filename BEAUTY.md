# The Standard of Beauty

> kbexplorer is a sensemaking instrument. For an instrument whose job is making
> a mess of information comprehensible, **visual clarity is not cosmetic — it is
> load-bearing**. A surface that is calm, legible, and honest about hierarchy
> *is* the feature working; a surface that is noisy or broken is comprehension
> failing, whatever the tests say.
>
> This document is the experiential quality bar. Structural gates (graph
> validation, link health, assessment scoring) say whether the knowledge graph
> is *sound*; this standard says whether the experience of moving through it is
> *beautiful* — and beauty here means: nothing between the reader and the
> understanding.

## 1. Principles

1. **Reading is the home.** The reading view is where comprehension happens;
   every other surface exists to get someone there and orient them. Prose
   typography is the single most important visual system in the product.
2. **The graph is an instrument, not wallpaper.** The constellation earns its
   place when it answers "where am I, what's nearby, what matters" at a glance.
   Density without legibility is decoration.
3. **Themes are commitments, not filters.** A theme is honored only when every
   element on the surface participates — icons, badges, and accents included.
   One dark-theme-blue element on sepia paper breaks the whole contract.
4. **Calm chrome, confident content.** Controls recede; content leads. The HUD
   should feel like a dashboard rail, never like a second application fighting
   for the viewport.
5. **No placeholder ships.** An empty box with a label is a broken promise in
   every screenshot, demo, and first impression. Render it or remove it.
6. **Small screens are real screens.** A surface that collapses into overlap at
   390px fails the standard regardless of how it looks at 1440px.

## 2. Scoring rubric

Each dimension scores 0–4 per surface: **4** exemplary (cite it as the bar) ·
**3** solid (no reader-visible defects) · **2** flawed (visible defects that
don't block) · **1** broken (defect interferes with use) · **0** absent.

| Dimension | What 4 looks like |
|---|---|
| **Typography & rhythm** | Measured line length (~70–80ch), confident hierarchy, code/inline chips contained, no orphan/clipping defects |
| **Hierarchy & composition** | One clear primary action/idea per surface; secondary chrome visually recedes; fold composition intentional |
| **Color & contrast** | WCAG AA at minimum on all text/badges; cluster palette discriminable; meaning never carried by color alone |
| **Theme fidelity** | Every element re-ramps per theme; no theme-invariant accents; per-theme contrast re-verified |
| **Graph legibility** | Labels readable at default zoom; neighborhood emphasis obvious; orphans handled compositionally, not scattered |
| **Responsive integrity** | No overlap/truncation at 390×844; touch targets ≥40px; HUD reflows or collapses gracefully |
| **States & polish** | Loading/empty/error states designed; no placeholder boxes; transitions smooth, not springy |

A surface **passes the bar** at ≥3 on every dimension. A release-blocking
defect is any 0–1 on a shipped surface.

## 3. Review protocol

1. `npm run capture:review` produces the canonical surface set
   (`scripts/review-surfaces.json` defines coverage; `review/capture-report.json`
   records skips). Captures are artifacts, never committed.
2. A frontier-model (or human) designer reviews the **rendered images** — never
   the source — and scores every surface × dimension against §2.
3. Findings become issues under the standard-of-beauty epic
   ([#239](https://github.com/anokye-labs/kbexplorer-template/issues/239)),
   each citing the rubric cell it remediates.
4. UI-touching PRs cite the criteria they affect; reviewers may demand a fresh
   capture of affected surfaces.
5. Re-assess after each remediation wave; update §4.

### Regression gate (issue #257)

The visual-regression gate (`npm run verify:visual`) diffs fresh captures
against committed baseline PNGs in `review/baselines/` using `pixelmatch`
(perceptual pixel diff, threshold 0.1 per channel; fail at >0.5% differing
pixels). Diff images land in `review/diffs/` (gitignored) for inspection.

**Gate runs:** nightly + `workflow_dispatch`
(`.github/workflows/visual-regression.yml`). **Not a PR gate** — captures are
environment-sensitive and baselines must be updated intentionally.

**Baseline bootstrap / update:**
```sh
npm run capture:review -- --update-baselines
git add review/baselines
git commit -m "chore(review): update visual baselines"
```

See `review/README.md` for the full gate specification.

## 4. Assessment — wave 1 (2026-06-12, captures `review/capture-report.json`)

Surfaces: home, reading, overview, constellation, HUD variants × dark/light/sepia × desktop/mobile.

| Surface (desktop) | Type | Hierarchy | Color | Theme | Graph | Responsive | States |
|---|---|---|---|---|---|---|---|
| Reading | **4** | **4** | 3 | 2 | — | **1** | 2 |
| Overview | 3 | **4** | 3 | 3 | — | n/c | 3 |
| Home | 3 | 3 | 2 | 3 | — | n/c | 3 |
| Constellation | — | 2 | 2 | 2 | **2** | n/c | 2 |
| HUD (bottom dock) | 3 | 3 | 3 | 2 | 3 | **1** | 2 |

**What sets the bar (keep, and cite):** the reading view's typographic system —
measure, heading rhythm, contained code chips, the icon + cluster-badge +
source-badge identity header — is genuinely excellent and is the reference
for every future surface. The sepia theme's paper-and-ink treatment shows the
themes can be real design, not recolors. The overview's cluster-grouped card
grid delivers the "instant map" promise.

**Findings (issues filed under #239):**

1. **Mobile HUD collapse failure** — at 390px the dock controls overlap the
   node-title bar, the MAP button truncates, and the RELATED rail collides
   with the controls panel. *Responsive: 1.*
2. **Theme-invariant accents** — node icons, related-rail icons, and the
   "Authored · …" source badge keep the dark palette on sepia/light; the pale
   blue badge on cream falls below readable contrast. *Theme: 2, Color: 2.*
3. **Placeholder minimap** — every reading/overview capture shows an empty
   "MAP" box bottom-left. Render the minimap or remove the box until ready.
   *States: 2 across surfaces.*
4. **Constellation orphan ring & label legibility** — disconnected dots ring
   the layout like noise; labels unreadable at default zoom; the in-canvas
   legend duplicates the HUD cluster list. *Graph: 2.*
5. **Home stat-strip contrast** — the uppercase stat labels sit near the
   gradient's low-contrast zone. *Color: 2 (home).*

n/c = not captured this wave. The `node-selected` surface currently captures a
reading page rather than neighborhood emphasis (capture-script limitation,
tracked in the capture PR); graph emphasis scoring is deferred to wave 2.
