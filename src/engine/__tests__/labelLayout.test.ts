import { describe, it, expect } from 'vitest';
import { assignLabelPlacements, type LabelItem } from '../labelLayout';

/** Convenience builder with sensible defaults. */
function item(p: Partial<LabelItem> & { id: string }): LabelItem {
  return {
    x: 0, y: 0, radius: 10, width: 40, height: 13, priority: 0,
    ...p,
  };
}

describe('assignLabelPlacements', () => {
  it('places an isolated label below the node (preferred anchor)', () => {
    const out = assignLabelPlacements([item({ id: 'a' })]);
    expect(out.get('a')).toEqual({ anchor: 'below', hidden: false });
  });

  it('never overlaps a node body with a label', () => {
    // Two nodes stacked vertically and close: the lower node's body sits where
    // the upper node's "below" label would go, forcing an alternate anchor.
    const items = [
      item({ id: 'top', x: 0, y: 0, radius: 10, width: 60 }),
      item({ id: 'bottom', x: 0, y: 28, radius: 10, width: 60 }),
    ];
    const out = assignLabelPlacements(items);
    // 'top' cannot go below (bottom node body is there) → must pick another anchor.
    expect(out.get('top')!.anchor).not.toBe('below');
    expect(out.get('top')!.hidden).toBe(false);
  });

  it('resolves two labels that would collide by choosing different anchors', () => {
    // Two nodes side-by-side; both "below" labels are wide enough to overlap.
    const items = [
      item({ id: 'l', x: 0, y: 0, radius: 10, width: 80, priority: 2 }),
      item({ id: 'r', x: 30, y: 0, radius: 10, width: 80, priority: 1 }),
    ];
    const out = assignLabelPlacements(items);
    // Higher-priority 'l' keeps 'below'; 'r' must move off 'below'.
    expect(out.get('l')).toEqual({ anchor: 'below', hidden: false });
    expect(out.get('r')!.anchor).not.toBe('below');
  });

  it('hides a label when no anchor is collision-free', () => {
    // Surround the target so every candidate anchor is occupied by a node body.
    const r = 10;
    const gap = 6;
    const off = r + gap + 7; // just inside each candidate label box
    const items = [
      item({ id: 'center', x: 0, y: 0, radius: r, width: 30, priority: 5 }),
      item({ id: 'n', x: 0, y: -off * 2, radius: 30, priority: 0 }),
      item({ id: 's', x: 0, y: off * 2, radius: 30, priority: 0 }),
      item({ id: 'e', x: off * 2, y: 0, radius: 30, priority: 0 }),
      item({ id: 'w', x: -off * 2, y: 0, radius: 30, priority: 0 }),
    ];
    const out = assignLabelPlacements(items, { gap });
    expect(out.get('center')!.hidden).toBe(true);
  });

  it('treats unlabeled nodes (obstacles) as forbidden too', () => {
    // One labeled node; an unlabeled node body sits exactly where its "below"
    // label would land. With the node passed via `obstacles`, the label must move.
    const labeled = item({ id: 'a', x: 0, y: 0, radius: 10, width: 40 });
    const obstacles = [
      { x: 0, y: 0, radius: 10 },       // the labeled node itself
      { x: 0, y: 30, radius: 14 },      // unlabeled node blocking "below"
    ];
    const out = assignLabelPlacements([labeled], { obstacles });
    expect(out.get('a')!.anchor).not.toBe('below');
    expect(out.get('a')!.hidden).toBe(false);
  });

  it('places higher-priority labels first (deterministic)', () => {
    const items = [
      item({ id: 'low', x: 0, y: 0, radius: 10, width: 80, priority: 1 }),
      item({ id: 'high', x: 20, y: 0, radius: 10, width: 80, priority: 9 }),
    ];
    const out = assignLabelPlacements(items);
    // 'high' is placed first and takes the preferred 'below' anchor.
    expect(out.get('high')).toEqual({ anchor: 'below', hidden: false });
  });

  it('is order-independent for the input array (sorts internally)', () => {
    const a = item({ id: 'a', x: 0, y: 0, priority: 5 });
    const b = item({ id: 'b', x: 200, y: 200, priority: 1 });
    const out1 = assignLabelPlacements([a, b]);
    const out2 = assignLabelPlacements([b, a]);
    expect(out1.get('a')).toEqual(out2.get('a'));
    expect(out1.get('b')).toEqual(out2.get('b'));
  });
});
