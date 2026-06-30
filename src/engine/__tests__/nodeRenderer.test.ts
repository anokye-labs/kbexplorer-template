import { describe, it, expect } from 'vitest';
import { createNodeRenderer, type RendererLabelState } from '../nodeRenderer';

/**
 * Minimal CanvasRenderingContext2D stub — records fillText/strokeText calls and
 * no-ops every other method the renderer touches. Property assignments (font,
 * fillStyle, …) are accepted and ignored.
 */
function makeCtx() {
  const fillTexts: string[] = [];
  const target: Record<string, unknown> = {
    fillText: (text: string) => { fillTexts.push(String(text)); },
    strokeText: () => {},
  };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      // Any other accessed method is a no-op.
      return () => {};
    },
    set(t, prop: string, value) { t[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fillTexts };
}

const args = (ctx: CanvasRenderingContext2D) => ({
  ctx, x: 100, y: 100,
  state: { selected: false, hover: false },
  style: { size: 40 },
});

describe('createNodeRenderer — edge-clip geometry (#435)', () => {
  it('returns nodeDimensions equal to the drawn circle box, not inflated by the label', () => {
    const size = 40;
    const render = createNodeRenderer(undefined, '#aabbcc', size, true, 'A long label here', false);
    const { ctx } = makeCtx();
    const out = render(args(ctx));
    // Circle: width == height == size. Previously height was size + 28 (label box),
    // which clipped edges to a too-tall rectangle → draw-through.
    expect(out.nodeDimensions).toEqual({ width: size, height: size });
  });

  it('keeps the same dimensions whether or not a label is present', () => {
    const size = 48;
    const withLabel = createNodeRenderer(undefined, '#aabbcc', size, false, 'hello', false)(args(makeCtx().ctx));
    const noLabel = createNodeRenderer(undefined, '#aabbcc', size, false, undefined, false)(args(makeCtx().ctx));
    expect(withLabel.nodeDimensions).toEqual(noLabel.nodeDimensions);
    expect(withLabel.nodeDimensions!.height).toBe(size);
  });
});

describe('createNodeRenderer — label placement (#435)', () => {
  it('does not paint a label when labelState marks it hidden', () => {
    const labelState = new Map<string, RendererLabelState>([
      ['n1', { text: 'secret', anchor: 'below', hidden: true }],
    ]);
    const render = createNodeRenderer(undefined, '#aabbcc', 40, true, 'secret', false, {
      id: 'n1', labelState,
    });
    const { ctx, fillTexts } = makeCtx();
    render(args(ctx));
    expect(fillTexts).not.toContain('secret');
  });

  it('paints the full (untruncated) label text when visible', () => {
    const full = 'A very long node title that used to be truncated';
    const labelState = new Map<string, RendererLabelState>([
      ['n1', { text: full, anchor: 'below', hidden: false }],
    ]);
    const render = createNodeRenderer(undefined, '#aabbcc', 40, true, full, false, {
      id: 'n1', labelState,
    });
    const { ctx, fillTexts } = makeCtx();
    render(args(ctx));
    expect(fillTexts).toContain(full);
  });

  it('falls back to the static label below when no labelState entry exists', () => {
    const render = createNodeRenderer(undefined, '#aabbcc', 40, true, 'fallback', false);
    const { ctx, fillTexts } = makeCtx();
    render(args(ctx));
    expect(fillTexts).toContain('fallback');
  });
});

describe('createNodeRenderer — focus override (#435)', () => {
  const selected = (ctx: CanvasRenderingContext2D) => ({
    ctx, x: 100, y: 100, state: { selected: true, hover: false }, style: { size: 40 },
  });
  const hovered = (ctx: CanvasRenderingContext2D) => ({
    ctx, x: 100, y: 100, state: { selected: false, hover: true }, style: { size: 40 },
  });

  it('draws the label of a SELECTED node even when collision layout hid it', () => {
    const full = 'Focused node title';
    const labelState = new Map<string, RendererLabelState>([
      ['n1', { text: full, anchor: 'below', hidden: true }],
    ]);
    const render = createNodeRenderer(undefined, '#aabbcc', 40, true, full, false, {
      id: 'n1', labelState,
    });
    const { ctx, fillTexts } = makeCtx();
    render(selected(ctx));
    expect(fillTexts).toContain(full);
  });

  it('draws the label of a HOVERED node even when collision layout hid it', () => {
    const full = 'Hovered node title';
    const labelState = new Map<string, RendererLabelState>([
      ['n1', { text: full, anchor: 'below', hidden: true }],
    ]);
    const render = createNodeRenderer(undefined, '#aabbcc', 40, true, full, false, {
      id: 'n1', labelState,
    });
    const { ctx, fillTexts } = makeCtx();
    render(hovered(ctx));
    expect(fillTexts).toContain(full);
  });

  it('uses focusLabel for a normally-unlabelled node when selected', () => {
    // No labelState entry and no static label (LOD-suppressed), but selecting it
    // must still reveal its full title via focusLabel.
    const title = 'Low-degree node';
    const render = createNodeRenderer(undefined, '#aabbcc', 40, true, undefined, false, {
      id: 'n2', labelState: new Map(), focusLabel: title,
    });
    const { ctx, fillTexts } = makeCtx();
    // Not focused → nothing painted.
    render(args(ctx));
    expect(fillTexts).not.toContain(title);
    // Selected → focusLabel painted.
    const { ctx: ctx2, fillTexts: ft2 } = makeCtx();
    render(selected(ctx2));
    expect(ft2).toContain(title);
  });
});
