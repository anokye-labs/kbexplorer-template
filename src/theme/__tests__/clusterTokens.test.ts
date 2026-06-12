import { describe, it, expect } from 'vitest';
import { clusterTokenStyle } from '../clusterTokens';

describe('clusterTokenStyle', () => {
  it('produces scoped CSS-var map (token name → value) for a cluster with deltas', () => {
    const style = clusterTokenStyle({
      colorBrandBackground: '#C04040',
      colorNeutralForeground1: '#ffffff',
    });
    expect(style).toEqual({
      '--colorBrandBackground': '#C04040',
      '--colorNeutralForeground1': '#ffffff',
    });
  });

  it('keeps already-prefixed custom property names verbatim', () => {
    expect(clusterTokenStyle({ '--colorBrandBackground': '#abc' })).toEqual({
      '--colorBrandBackground': '#abc',
    });
  });

  it('produces no overrides (empty, no-op) for an undefined delta map', () => {
    expect(clusterTokenStyle(undefined)).toEqual({});
  });

  it('produces no overrides for an empty delta map', () => {
    expect(clusterTokenStyle({})).toEqual({});
  });

  it('skips undefined values so they never leak as overrides', () => {
    const style = clusterTokenStyle({
      colorBrandBackground: '#C04040',
      colorNeutralForeground1: undefined,
    });
    expect(style).toEqual({ '--colorBrandBackground': '#C04040' });
    expect('--colorNeutralForeground1' in style).toBe(false);
  });

  it('returns a fresh object that does not mutate the input', () => {
    const input = { colorBrandBackground: '#C04040' };
    const style = clusterTokenStyle(input);
    expect(style).not.toBe(input);
    expect(input).toEqual({ colorBrandBackground: '#C04040' });
  });
});
