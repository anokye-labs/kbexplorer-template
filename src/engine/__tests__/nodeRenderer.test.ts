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
