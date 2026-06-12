import { describe, it, expect } from 'vitest';
import { generateBrandVariants } from '../brandRamp';

const STOP_KEYS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;

function hexLightness(hex: string): number {
  const value = hex.replace(/^#/, '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

describe('generateBrandVariants', () => {
  it('returns exactly the 16 stop keys "10".."160"', () => {
    const ramp = generateBrandVariants('#4A9CC8');
    expect(Object.keys(ramp).map(Number).sort((a, b) => a - b)).toEqual([...STOP_KEYS]);
    expect(Object.keys(ramp)).toHaveLength(16);
  });

  it('produces valid 6-digit hex values for every stop', () => {
    const ramp = generateBrandVariants('#4A9CC8');
    for (const key of STOP_KEYS) {
      expect(ramp[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('is monotonically ascending in lightness from "10" to "160"', () => {
    const ramp = generateBrandVariants('#4A9CC8');
    const lightnesses = STOP_KEYS.map((key) => hexLightness(ramp[key]));
    for (let i = 1; i < lightnesses.length; i += 1) {
      expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
    }
  });

  it('clamps endpoints toward near-black and near-white', () => {
    const ramp = generateBrandVariants('#4A9CC8');
    expect(hexLightness(ramp[10])).toBeLessThan(0.08);
    expect(hexLightness(ramp[160])).toBeGreaterThan(0.92);
  });

  it('maps the seed near the middle of the ramp', () => {
    const seedL = hexLightness('#4A9CC8');
    const ramp = generateBrandVariants('#4A9CC8');
    const middleL = hexLightness(ramp[80]);
    expect(Math.abs(middleL - seedL)).toBeLessThan(0.06);
  });

  it('is deterministic: same seed → same ramp', () => {
    expect(generateBrandVariants('#4A9CC8')).toEqual(generateBrandVariants('#4A9CC8'));
  });

  it('normalizes 3-digit, unprefixed, and mixed-case hex equivalently', () => {
    const canonical = generateBrandVariants('#4488CC');
    expect(generateBrandVariants('4488cc')).toEqual(canonical);
    expect(generateBrandVariants('#48c')).toEqual(canonical);
    expect(generateBrandVariants('48C')).toEqual(canonical);
  });

  it('throws on invalid hex input', () => {
    expect(() => generateBrandVariants('not-a-color')).toThrow();
    expect(() => generateBrandVariants('#12')).toThrow();
    expect(() => generateBrandVariants('#12345')).toThrow();
  });

  it('matches the committed snapshot for seed "#4A9CC8"', () => {
    expect(generateBrandVariants('#4A9CC8')).toMatchInlineSnapshot(`
      {
        "10": "#04090C",
        "100": "#74B3D5",
        "110": "#89BFDB",
        "120": "#9FCAE2",
        "130": "#B4D6E8",
        "140": "#C9E1EF",
        "150": "#DEEDF5",
        "160": "#F3F9FB",
        "20": "#0C1E28",
        "30": "#153444",
        "40": "#1D4961",
        "50": "#265F7D",
        "60": "#2F7499",
        "70": "#378AB6",
        "80": "#4A9CC8",
        "90": "#5FA8CE",
      }
    `);
  });
});
