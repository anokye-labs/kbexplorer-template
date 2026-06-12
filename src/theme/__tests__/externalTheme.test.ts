import { describe, it, expect, vi } from 'vitest';
import {
  parseExternalTheme,
  mergeExternalTheme,
  loadExternalTheme,
  applyExternalThemeFile,
} from '../externalTheme';
import { DEFAULT_CONFIG } from '../../types';
import type { KBConfig } from '../../types';

// Pure-function tests only (node env, no jsdom / React). Covers the external
// theme file parse + merge helpers and the loader against a mocked fetch.

describe('parseExternalTheme', () => {
  it('parses a themes map with brand/tokens/base', () => {
    const parsed = parseExternalTheme(`
themes:
  forest:
    base: dark
    brand: "#2E7D32"
    tokens:
      colorNeutralBackground1: "#0B1A0B"
`);
    expect(parsed).not.toBeNull();
    expect(parsed!.themes!.forest).toEqual({
      base: 'dark',
      brand: '#2E7D32',
      tokens: { colorNeutralBackground1: '#0B1A0B' },
    });
  });

  it('parses top-level default / brand / tokens', () => {
    const parsed = parseExternalTheme(`
default: forest
brand: "#4A9CC8"
tokens:
  borderRadiusMedium: "8px"
`);
    expect(parsed).toEqual({
      default: 'forest',
      brand: '#4A9CC8',
      tokens: { borderRadiusMedium: '8px' },
    });
  });

  it('parses a brand ramp object verbatim', () => {
    const parsed = parseExternalTheme(`
themes:
  ramped:
    brand:
      "10": "#020305"
      "160": "#EAF3F8"
`);
    const brand = parsed!.themes!.ramped.brand as Record<string, string>;
    expect(brand['10']).toBe('#020305');
    expect(brand['160']).toBe('#EAF3F8');
  });

  it('returns null for malformed YAML', () => {
    // Unterminated flow mapping is a YAML parse error.
    expect(parseExternalTheme('themes: {forest: ')).toBeNull();
  });

  it('returns null for a non-object document (scalar / array / null)', () => {
    expect(parseExternalTheme('"just a string"')).toBeNull();
    expect(parseExternalTheme('- a\n- b')).toBeNull();
    expect(parseExternalTheme('')).toBeNull();
    expect(parseExternalTheme('null')).toBeNull();
  });

  it('returns null when themes is present but not a mapping', () => {
    expect(parseExternalTheme('themes: "nope"')).toBeNull();
    expect(parseExternalTheme('themes:\n  - a\n  - b')).toBeNull();
  });

  it('parses an empty mapping to an empty object (recognized, no data)', () => {
    expect(parseExternalTheme('{}')).toEqual({});
  });

  it('ignores non-object theme entries rather than crashing', () => {
    const parsed = parseExternalTheme(`
themes:
  good:
    brand: "#111111"
  bad: "not an object"
`);
    expect(Object.keys(parsed!.themes!)).toEqual(['good']);
  });
});

describe('mergeExternalTheme', () => {
  const baseTheme: KBConfig['theme'] = {
    default: 'dark',
    themes: {
      ocean: { base: 'dark', brand: '#1B6CA8' },
    },
  };

  it('adds an external theme that is not in config', () => {
    const merged = mergeExternalTheme(baseTheme, {
      themes: { forest: { base: 'dark', brand: '#2E7D32' } },
    });
    expect(Object.keys(merged.themes!)).toEqual(['ocean', 'forest']);
    expect(merged.themes!.forest).toEqual({ base: 'dark', brand: '#2E7D32' });
    // config theme untouched
    expect(merged.themes!.ocean).toEqual({ base: 'dark', brand: '#1B6CA8' });
  });

  it('field-merges a same-named theme with external winning', () => {
    const merged = mergeExternalTheme(baseTheme, {
      themes: {
        ocean: { brand: '#0099FF', tokens: { colorNeutralBackground1: '#001324' } },
      },
    });
    // base kept from config (external didn't set it), brand overridden by external
    expect(merged.themes!.ocean).toEqual({
      base: 'dark',
      brand: '#0099FF',
      tokens: { colorNeutralBackground1: '#001324' },
    });
  });

  it('shallow-merges same-named theme tokens, external winning per key', () => {
    const withTokens: KBConfig['theme'] = {
      default: 'dark',
      themes: { ocean: { tokens: { a: '1', b: '2' } } },
    };
    const merged = mergeExternalTheme(withTokens, {
      themes: { ocean: { tokens: { b: '20', c: '3' } } },
    });
    expect(merged.themes!.ocean.tokens).toEqual({ a: '1', b: '20', c: '3' });
  });

  it('overrides top-level default / brand and merges top-level tokens', () => {
    const cfg: KBConfig['theme'] = {
      default: 'dark',
      brand: '#111111',
      tokens: { a: '1' },
    };
    const merged = mergeExternalTheme(cfg, {
      default: 'forest',
      brand: '#222222',
      tokens: { b: '2' },
    });
    expect(merged.default).toBe('forest');
    expect(merged.brand).toBe('#222222');
    expect(merged.tokens).toEqual({ a: '1', b: '2' });
  });

  it('keeps config values when the external file omits those fields', () => {
    const merged = mergeExternalTheme(baseTheme, { themes: { forest: {} } });
    expect(merged.default).toBe('dark');
  });

  it('is a no-op fallback when external is null/undefined', () => {
    expect(mergeExternalTheme(baseTheme, null)).toBe(baseTheme);
    expect(mergeExternalTheme(baseTheme, undefined)).toBe(baseTheme);
  });

  it('does not mutate its inputs', () => {
    const cfg: KBConfig['theme'] = { default: 'dark', themes: { ocean: { brand: '#1B6CA8' } } };
    const snapshot = JSON.parse(JSON.stringify(cfg));
    mergeExternalTheme(cfg, { themes: { ocean: { brand: '#000000' }, forest: { brand: '#2E7D32' } } });
    expect(cfg).toEqual(snapshot);
  });
});

describe('loadExternalTheme', () => {
  it('returns null (no fetch) when themesFile is unset', async () => {
    const fetchRaw = vi.fn();
    const result = await loadExternalTheme(undefined, fetchRaw);
    expect(result).toBeNull();
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('fetches and parses when themesFile is set', async () => {
    const fetchRaw = vi.fn().mockResolvedValue('themes:\n  forest:\n    brand: "#2E7D32"');
    const result = await loadExternalTheme('content/themes/extra.yaml', fetchRaw);
    expect(fetchRaw).toHaveBeenCalledWith('content/themes/extra.yaml');
    expect(result!.themes!.forest.brand).toBe('#2E7D32');
  });

  it('is a no-op fallback (null) when the fetch rejects', async () => {
    const fetchRaw = vi.fn().mockRejectedValue(new Error('404'));
    const result = await loadExternalTheme('missing.yaml', fetchRaw);
    expect(result).toBeNull();
  });

  it('returns null when the fetched file is malformed', async () => {
    const fetchRaw = vi.fn().mockResolvedValue('themes: {oops: ');
    const result = await loadExternalTheme('bad.yaml', fetchRaw);
    expect(result).toBeNull();
  });
});

describe('applyExternalThemeFile', () => {
  it('fetches + merges into the config theme block', async () => {
    const cfg: KBConfig['theme'] = {
      default: 'dark',
      themesFile: 'content/themes/extra.yaml',
      themes: { ocean: { brand: '#1B6CA8' } },
    };
    const fetchRaw = vi.fn().mockResolvedValue('themes:\n  forest:\n    brand: "#2E7D32"');
    const merged = await applyExternalThemeFile(cfg, fetchRaw);
    expect(Object.keys(merged.themes!)).toEqual(['ocean', 'forest']);
  });

  it('returns the config theme unchanged when themesFile is unset', async () => {
    const cfg = DEFAULT_CONFIG.theme;
    const fetchRaw = vi.fn();
    const merged = await applyExternalThemeFile(cfg, fetchRaw);
    expect(merged).toBe(cfg);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('returns the config theme effectively unchanged when the file is missing', async () => {
    const cfg: KBConfig['theme'] = {
      default: 'dark',
      themesFile: 'missing.yaml',
      themes: { ocean: { brand: '#1B6CA8' } },
    };
    const fetchRaw = vi.fn().mockRejectedValue(new Error('404'));
    const merged = await applyExternalThemeFile(cfg, fetchRaw);
    expect(merged.themes).toEqual({ ocean: { brand: '#1B6CA8' } });
  });
});
