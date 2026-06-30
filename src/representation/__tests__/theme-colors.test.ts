import { describe, it, expect, afterEach } from 'vitest';
import {
  styleColorVar,
  resolveStyleColor,
  withAlpha,
  EDGE_TYPE_STYLES,
  RELATION_STYLES,
  NODE_LAYER_META,
} from '../styles';

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
