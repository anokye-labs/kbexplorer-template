import { describe, it, expect } from 'vitest';
import { parseColor, normalizeColorToHex, colorIsDark } from '../color';

describe('parseColor', () => {
  it('parses short hex (#rgb)', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#0af')).toEqual({ r: 0, g: 170, b: 255 });
  });
  it('parses full hex (#rrggbb)', () => {
    expect(parseColor('#0d1117')).toEqual({ r: 13, g: 17, b: 23 });
  });
  it('parses comma- and space-separated rgb()/rgba()', () => {
    expect(parseColor('rgb(47, 129, 247)')).toEqual({ r: 47, g: 129, b: 247 });
    expect(parseColor('rgba(20, 20, 24, 0.5)')).toEqual({ r: 20, g: 20, b: 24 });
    expect(parseColor('rgb(245 245 245)')).toEqual({ r: 245, g: 245, b: 245 });
  });
  it('returns null for unrecognized syntaxes', () => {
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('hsl(200,50%,50%)')).toBeNull();
  });
});

describe('normalizeColorToHex', () => {
  it('normalizes short hex and rgb() to #rrggbb', () => {
    expect(normalizeColorToHex('#fff')).toBe('#ffffff');
    expect(normalizeColorToHex('#0af')).toBe('#00aaff');
    expect(normalizeColorToHex('rgb(47, 129, 247)')).toBe('#2f81f7');
    expect(normalizeColorToHex('#0D1117')).toBe('#0d1117');
  });
  it('returns null when it cannot parse', () => {
    expect(normalizeColorToHex('not-a-color')).toBeNull();
  });
});

describe('colorIsDark', () => {
  it('classifies short-hex and rgb() colors by luminance', () => {
    expect(colorIsDark('#000')).toBe(true);
    expect(colorIsDark('#fff')).toBe(false);
    expect(colorIsDark('rgb(13, 17, 23)')).toBe(true);
    expect(colorIsDark('rgb(245, 245, 245)')).toBe(false);
  });
  it('returns null for an unparseable color', () => {
    expect(colorIsDark('chartreuse')).toBeNull();
  });
});
