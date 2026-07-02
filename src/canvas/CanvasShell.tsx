/**
 * CanvasShell — the documented layout primitive for the `copilot` canvas
 * surface (#412, epic #407 / #401).
 *
 * Wraps the `copilot` target's `<Routes>` (`representation/targets/copilot.tsx`)
 * so every route (`AnchorFirstView`, the constellation zoom-out, the overview)
 * renders inside the SAME narrow, panel-friendly column. #409–#411 render their
 * additions (agent actions, click→chat controls, the affordance launchpad)
 * inside this shell, so they all inherit the same rhythm without re-deriving it.
 *
 * ## Design rules this primitive encodes
 *
 * 1. **~400px-friendly column.** The shell never assumes a fixed viewport — a
 *    Copilot canvas panel is host-sized (often ~400px, sometimes narrower) — so
 *    it is fluid width (`width: 100%`) with `box-sizing: border-box` and
 *    `overflow-x: hidden`. Nothing inside should force horizontal scroll; long
 *    titles/urls wrap instead (enforced by the viewers + `AnchorFirstView`
 *    header, not re-implemented here).
 * 2. **Consistent vertical rhythm.** A single `rowGap` (Fluent
 *    `spacingVerticalL`) is the ONE place gap between the shell's OWN direct
 *    children is decided. Today the shell wraps a single `<Routes>` element, so
 *    this has no visible effect yet — it exists for if/when the shell gains a
 *    second direct child (e.g. a persistent header/toolbar above the routed
 *    content), so that addition doesn't invent its own ad-hoc gap. It does NOT
 *    control spacing *within* a route's own content (`AnchorFirstView`'s
 *    internal `section`/`header` gaps are that view's own concern).
 * 3. **Host tokens only — no re-mirrored CSS vars.** Every color/spacing value
 *    here is a Fluent `tokens.*` reference, which `inherit-host`
 *    (`useCanvasTheme`) already resolves from the host's mirrored vars via
 *    `FluentProvider`. This primitive must NEVER read `--background-color-*` /
 *    `--text-color-*` directly (a prior audit flagged that re-mirroring
 *    elsewhere) — Fluent tokens are the only host-color seam.
 * 4. **No pixels for layout.** Every dimension here is `%`, `vh`, or a Fluent
 *    token; the only allowed pixel is the invariant `1px` border rule.
 *
 * The shell is intentionally "dumb": it does not know about routes, actions, or
 * affordances. It just supplies the column + rhythm + scroll container that
 * everything else renders into.
 */
import type { ReactNode } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    // A definite viewport-relative height (not `minHeight: '100%'`, which
    // never resolves unless an ancestor has an explicit `height` — the canvas
    // mount chain up to `#root` does not set one). `100vh` is independent of
    // any ancestor, so it always resolves, which is what makes `overflowY:
    // 'auto'` below a REAL scroll container: content taller than the host
    // viewport scrolls inside the shell instead of growing the outer
    // document (verified by the `canvas-shell.spec.ts` scroll-containment
    // test).
    height: '100vh',
    boxSizing: 'border-box',
    // Narrow-column invariant: content wraps, it never scrolls sideways.
    overflowX: 'hidden',
    overflowY: 'auto',
    rowGap: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
});

export interface CanvasShellProps {
  children: ReactNode;
}

/**
 * The narrow-column shell every `copilot` route renders inside. See the module
 * doc for the invariants this encodes (column width, rhythm, host tokens only).
 */
export function CanvasShell({ children }: CanvasShellProps) {
  const styles = useStyles();
  return (
    <div className={styles.root} data-testid="canvas-shell" data-kbx-shell="canvas">
      {children}
    </div>
  );
}

export default CanvasShell;
