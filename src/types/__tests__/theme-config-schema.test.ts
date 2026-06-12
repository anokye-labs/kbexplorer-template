import { describe, it, expect } from 'vitest';
import yaml from 'yaml';
import { DEFAULT_CONFIG } from '../index';
import type { KBConfig } from '../index';

// Mirrors the parse + shallow-merge that loadConfig() performs in
// src/engine/parser.ts (including the final `source` injection), without the
// network fetch. Validates that the additive theme.brand / theme.tokens /
// theme.themes fields round-trip from config.yaml into a typed KBConfig with
// the expected shapes.

function parseConfigYaml(raw: string): KBConfig {
  const source = DEFAULT_CONFIG.source;
  const parsed = yaml.parse(raw) as Partial<KBConfig>;
  return { ...DEFAULT_CONFIG, ...parsed, source };
}

describe('KBConfig.theme schema (brand, tokens, themes)', () => {
  it('round-trips theme.brand as a single seed hex string', () => {
    const config = parseConfigYaml(`
title: Test KB
theme:
  default: dark
  brand: "#4A9CC8"
`);
    expect(typeof config.theme.brand).toBe('string');
    expect(config.theme.brand).toBe('#4A9CC8');
  });

  it('round-trips theme.brand as a 16-key Fluent ramp object', () => {
    const config = parseConfigYaml(`
title: Test KB
theme:
  default: dark
  brand:
    "10": "#020305"
    "20": "#111A1F"
    "30": "#16242C"
    "40": "#1B2F39"
    "50": "#1F3B47"
    "60": "#244655"
    "70": "#295264"
    "80": "#2E5E73"
    "90": "#336A82"
    "100": "#387691"
    "110": "#4A9CC8"
    "120": "#5BA8D0"
    "130": "#6CB4D8"
    "140": "#90C8E2"
    "150": "#B5DCEC"
    "160": "#EAF3F8"
`);
    const brand = config.theme.brand as Record<string, string>;
    expect(typeof brand).toBe('object');
    expect(Object.keys(brand)).toHaveLength(16);
    expect(brand['10']).toBe('#020305');
    expect(brand['110']).toBe('#4A9CC8');
    expect(brand['160']).toBe('#EAF3F8');
  });

  it('round-trips theme.tokens as arbitrary token overrides', () => {
    const config = parseConfigYaml(`
title: Test KB
theme:
  default: light
  tokens:
    colorNeutralBackground1: "#101418"
    borderRadiusMedium: "8px"
`);
    expect(config.theme.tokens).toEqual({
      colorNeutralBackground1: '#101418',
      borderRadiusMedium: '8px',
    });
  });

  it('round-trips theme.themes named variants with brand/tokens/base', () => {
    const config = parseConfigYaml(`
title: Test KB
theme:
  default: dark
  themes:
    ocean:
      base: dark
      brand: "#1B6CA8"
      tokens:
        colorNeutralBackground1: "#0A1A24"
    parchment:
      base: light
      brand:
        "10": "#1A1206"
        "110": "#B5832E"
        "160": "#FBF3E2"
`);
    const themes = config.theme.themes!;
    expect(Object.keys(themes)).toHaveLength(2);
    expect(themes).toHaveProperty('ocean');
    expect(themes).toHaveProperty('parchment');

    expect(themes.ocean.base).toBe('dark');
    expect(themes.ocean.brand).toBe('#1B6CA8');
    expect(themes.ocean.tokens).toEqual({ colorNeutralBackground1: '#0A1A24' });

    expect(themes.parchment.base).toBe('light');
    const parchmentBrand = themes.parchment.brand as Record<string, string>;
    expect(parchmentBrand['110']).toBe('#B5832E');
  });

  it('keeps the new fields optional — a minimal theme still type-checks', () => {
    const config = parseConfigYaml(`
title: Test KB
theme:
  default: sepia
`);
    expect(config.theme.default).toBe('sepia');
    expect(config.theme.brand).toBeUndefined();
    expect(config.theme.tokens).toBeUndefined();
    expect(config.theme.themes).toBeUndefined();
  });

  it('DEFAULT_CONFIG leaves brand/tokens/themes unset (no behavior change)', () => {
    expect(DEFAULT_CONFIG.theme.brand).toBeUndefined();
    expect(DEFAULT_CONFIG.theme.tokens).toBeUndefined();
    expect(DEFAULT_CONFIG.theme.themes).toBeUndefined();
  });
});
