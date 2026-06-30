import { describe, it, expect, afterEach } from 'vitest';
import {
  styleColorVar,
  resolveStyleColor,
  withAlpha,
  emphasisEdgeStyle,
  EDGE_TYPE_STYLES,
  RELATION_STYLES,
  NODE_LAYER_META,
} from '../styles';

/** A bare hex suffix appended to an rgb() string — the bug this guards against. */
const INVALID_RGB_SUFFIX = /rgba?\([^)]*\)[0-9a-fA-F]{2}\b/;
/** Accepts hex (#rrggbb), rgb(...) or rgba(...) — the valid CSS color forms we emit. */
const VALID_COLOR = /^(#[0-9a-fA-F]{6}|rgba?\([^)]*\))$/;

describe('withAlpha', () => {
  it('converts a hex color to rgba with the given alpha', () => {
    expect(withAlpha('#a78bfa', 0.5)).toBe('rgba(167, 139, 250, 0.5)');
    expect(withAlpha('#000000', 0.25)).toBe('rgba(0, 0, 0, 0.25)');
  });

  it('re-alphas an rgb()/rgba() color instead of producing an invalid suffix', () => {
    expect(withAlpha('rgb(160, 173, 184)', 0.5)).toBe('rgba(160, 173, 184, 0.5)');
    expect(withAlpha('rgba(20, 20, 24, 1)', 0.25)).toBe('rgba(20, 20, 24, 0.25)');
  });

  it('returns the original string for an unparseable color', () => {
    expect(withAlpha('var(--x)', 0.5)).toBe('var(--x)');
  });
});

describe('emphasisEdgeStyle', () => {
  // The regression: focus/emphasis must never append a hex alpha suffix to a
  // resolved rgb() color (e.g. `rgb(205, 214, 216)80`). Assert every tier emits
  // a VALID color for BOTH a hex-fallback color and a CSS-var-resolved rgb() one.
  for (const base of ['#a0adb8', 'rgb(205, 214, 216)']) {
    it(`emits valid colors across all tiers for base ${base}`, () => {
      // (maxHop, minHop) per tier: direct, tier1, tier2, distant.
      const cases: Array<[number, number]> = [[1, 0], [2, 1], [2, 2], [5, 3]];
      for (const [maxHop, minHop] of cases) {
        const r = emphasisEdgeStyle(base, 2, false, maxHop, minHop, true);
        expect(r.color).toMatch(VALID_COLOR);
        expect(r.color).not.toMatch(INVALID_RGB_SUFFIX);
        expect(r.width).toBeGreaterThan(0);
      }
    });
  }

  it('applies the expected translucency per tier', () => {
    const c = 'rgb(205, 214, 216)';
    expect(emphasisEdgeStyle(c, 2, false, 1, 0, true).color).toBe(c);                 // direct: full
    expect(emphasisEdgeStyle(c, 2, false, 2, 1, true).color).toBe('rgba(205, 214, 216, 0.5)');  // tier 1
    expect(emphasisEdgeStyle(c, 2, false, 2, 2, true).color).toBe('rgba(205, 214, 216, 0.25)'); // tier 2
    expect(emphasisEdgeStyle(c, 2, false, 5, 3, true).color).toBe('rgba(60,60,60,0.15)');       // distant (dark)
    expect(emphasisEdgeStyle(c, 2, false, 5, 3, false).color).toBe('rgba(180,180,180,0.15)');   // distant (light)
  });
});

describe('styleColorVar', () => {
  it('wraps a tokenized color as a var() with the hex as fallback', () => {
    expect(styleColorVar({ color: '#a78bfa', token: 'colorPalettePurpleForeground2' }))
      .toBe('var(--colorPalettePurpleForeground2, #a78bfa)');
  });

  it('returns the literal hex when no token is present', () => {
    expect(styleColorVar({ color: '#123456' })).toBe('#123456');
  });
});

describe('resolveStyleColor', () => {
  const originalGCS = (globalThis as Record<string, unknown>).getComputedStyle;

  afterEach(() => {
    if (originalGCS === undefined) delete (globalThis as Record<string, unknown>).getComputedStyle;
    else (globalThis as Record<string, unknown>).getComputedStyle = originalGCS;
  });

  it('falls back to the literal hex when the DOM is unavailable (SSR/node)', () => {
    delete (globalThis as Record<string, unknown>).getComputedStyle;
    expect(resolveStyleColor({ color: '#a78bfa', token: 'colorPalettePurpleForeground2' }, null))
      .toBe('#a78bfa');
  });

  it('returns the hex when there is no token even with a DOM present', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
    expect(resolveStyleColor({ color: '#abcdef' }, {} as Element)).toBe('#abcdef');
  });

  it('reads the resolved CSS variable from the root when set', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = (el: unknown) => ({
      getPropertyValue: (name: string) =>
        name === '--colorPalettePurpleForeground2' && el ? '  #c6b1de  ' : '',
    });
    expect(resolveStyleColor({ color: '#a78bfa', token: 'colorPalettePurpleForeground2' }, {} as Element))
      .toBe('#c6b1de');
  });

  it('falls back to the hex when the variable resolves empty', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = () => ({ getPropertyValue: () => '' });
    expect(resolveStyleColor({ color: '#a78bfa', token: 'colorPalettePurpleForeground2' }, {} as Element))
      .toBe('#a78bfa');
  });
});

describe('tokenized style tables', () => {
  it('assigns a Fluent CSS-var token to every edge type', () => {
    for (const style of Object.values(EDGE_TYPE_STYLES)) {
      expect(style.token).toBeTruthy();
      expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('assigns a token to every relation style', () => {
    for (const style of Object.values(RELATION_STYLES)) {
      expect(style.token).toBeTruthy();
    }
  });

  it('assigns a token to every node layer', () => {
    for (const meta of Object.values(NODE_LAYER_META)) {
      expect(meta.token).toBeTruthy();
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
