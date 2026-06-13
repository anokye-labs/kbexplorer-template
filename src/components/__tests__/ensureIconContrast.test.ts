import { describe, it, expect } from 'vitest';
import { ensureIconContrast } from '../NodeVisual';

/** Approx relative-lightness check: parse a #rrggbb hex to HSL lightness. */
function lightness(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 0xff) / 255, g = ((n >> 8) & 0xff) / 255, b = (n & 0xff) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe('ensureIconContrast (#250)', () => {
  it('passes the color through unchanged on dark themes', () => {
    expect(ensureIconContrast('#E8A838', true)).toBe('#E8A838');
  });

  it('returns undefined/empty inputs untouched', () => {
    expect(ensureIconContrast(undefined, false)).toBeUndefined();
  });

  it('darkens a light 6-digit accent to L <= 0.42 on a non-dark theme', () => {
    const out = ensureIconContrast('#E8A838', false)!; // gold, L ~0.56
    expect(out).not.toBe('#E8A838');
    expect(lightness(out)).toBeLessThanOrEqual(0.43); // small float margin
  });

  it('handles 3-digit hex (the bug Copilot flagged) — does not bypass the clamp', () => {
    const out = ensureIconContrast('#fc0', false)!; // == #ffcc00, very light
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(lightness(out)).toBeLessThanOrEqual(0.43);
  });

  it('leaves an already-dark color unchanged on a non-dark theme', () => {
    // #1A6B2A has L well below 0.42 — should be returned as-is.
    expect(ensureIconContrast('#1A6B2A', false)).toBe('#1A6B2A');
  });

  it('returns unparseable input unchanged', () => {
    expect(ensureIconContrast('not-a-color', false)).toBe('not-a-color');
  });
});
