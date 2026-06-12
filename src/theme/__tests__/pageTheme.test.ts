import { describe, it, expect } from 'vitest';
import { webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { pageThemeTokenDeltas, pageThemeStyle } from '../pageTheme';
import { buildThemeMap } from '../../hooks/useTheme';
import type { PageTheme } from '../../types';

describe('pageThemeTokenDeltas', () => {
  it('returns an empty map (no-op) when no page theme is declared', () => {
    expect(pageThemeTokenDeltas(webDarkTheme, undefined)).toEqual({});
    expect(pageThemeTokenDeltas(webDarkTheme, {})).toEqual({});
  });

  it('passes explicit token deltas through unchanged', () => {
    const page: PageTheme = { tokens: { colorNeutralBackground1: '#101418', borderRadiusMedium: '8px' } };
    expect(pageThemeTokenDeltas(webDarkTheme, page)).toEqual({
      colorNeutralBackground1: '#101418',
      borderRadiusMedium: '8px',
    });
  });

  it('recolors brand-family tokens from an accent seed without touching neutrals', () => {
    const deltas = pageThemeTokenDeltas(webDarkTheme, { accent: '#C04040' });
    // Brand tokens are produced and differ from the default dark brand.
    expect(deltas.colorBrandBackground).toBeDefined();
    expect(deltas.colorBrandBackground).not.toBe(webDarkTheme.colorBrandBackground);
    // Neutral/background tokens are not emitted by an accent-only page theme.
    expect('colorNeutralBackground1' in deltas).toBe(false);
  });

  it('ignores an unparseable accent seed (no-op)', () => {
    expect(pageThemeTokenDeltas(webDarkTheme, { accent: 'not-a-color' })).toEqual({});
  });

  it('adopts a named theme as deltas relative to the active base', () => {
    const map = buildThemeMap();
    // From dark base, adopting the light theme yields deltas that match light.
    const deltas = pageThemeTokenDeltas(webDarkTheme, { theme: 'light' }, map);
    expect(deltas.colorNeutralBackground1).toBe(webLightTheme.colorNeutralBackground1);
    // Tokens identical between dark and light are not emitted.
    for (const [k, v] of Object.entries(deltas)) {
      expect(v).not.toBe((webDarkTheme as Record<string, unknown>)[k]);
    }
  });

  it('ignores an unknown named theme', () => {
    expect(pageThemeTokenDeltas(webDarkTheme, { theme: 'no-such-theme' }, buildThemeMap())).toEqual({});
  });

  it('layers tokens (highest) over accent over named theme', () => {
    const page: PageTheme = {
      theme: 'light',
      accent: '#C04040',
      tokens: { colorBrandBackground: '#00FF00', colorNeutralBackground1: '#123456' },
    };
    const deltas = pageThemeTokenDeltas(webDarkTheme, page, buildThemeMap());
    // Explicit token wins over the accent-derived brand value.
    expect(deltas.colorBrandBackground).toBe('#00FF00');
    // Explicit token wins over the named-theme background value.
    expect(deltas.colorNeutralBackground1).toBe('#123456');
  });
});

describe('pageThemeStyle', () => {
  it('emits scoped CSS custom properties for the page deltas', () => {
    const style = pageThemeStyle(webDarkTheme, { tokens: { colorNeutralBackground1: '#101418' } });
    expect(style).toEqual({ '--colorNeutralBackground1': '#101418' });
  });

  it('is an empty (no-op) style object for an unthemed page', () => {
    expect(pageThemeStyle(webDarkTheme, undefined)).toEqual({});
  });
});
