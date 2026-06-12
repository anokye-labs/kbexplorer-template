import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveInitialMode, readStoredRaw, buildThemeMap } from '../useTheme';
import { generateBrandVariants } from '../../theme/brandRamp';
import { webDarkTheme, webLightTheme, createDarkTheme } from '@fluentui/react-components';

const STORAGE_KEY = 'kbe-theme';

function installLocalStorage() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  (globalThis as { localStorage?: unknown }).localStorage = mock;
}

describe('useTheme initial mode resolution', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('config.default applies when no stored theme', () => {
    expect(readStoredRaw()).toBeNull();
    expect(resolveInitialMode('light')).toBe('light');
  });

  it('stored theme wins over config.default', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia');
    expect(resolveInitialMode('light')).toBe('sepia');
  });

  it('falls back to dark when no stored theme and no config default', () => {
    expect(resolveInitialMode(undefined)).toBe('dark');
  });

  it('ignores an invalid config default and falls back to dark', () => {
    expect(resolveInitialMode('chartreuse' as unknown as 'dark')).toBe('dark');
  });
});

describe('buildThemeMap', () => {
  it('applies a global brand (hex) and token overrides to the base themes', () => {
    const seed = '#4A9CC8';
    const map = buildThemeMap({
      default: 'dark',
      brand: seed,
      tokens: { colorNeutralBackground1: '#101418' },
    });

    // Explicit token override wins over the generated theme.
    expect(map.dark.colorNeutralBackground1).toBe('#101418');

    // The brand ramp is generated from the seed via generateBrandVariants and
    // fed through createDarkTheme, so a brand-derived token matches.
    const expected = createDarkTheme(generateBrandVariants(seed));
    expect(map.dark.colorBrandBackground).toBe(expected.colorBrandBackground);
  });

  it('registers each named theme.themes entry as a selectable theme', () => {
    const map = buildThemeMap({
      default: 'dark',
      themes: {
        ocean: {
          base: 'light',
          brand: '#1B6CA8',
          tokens: { colorNeutralBackground1: '#E0F0FA' },
        },
      },
    });

    expect(map.ocean).toBeDefined();
    expect(map.ocean.colorNeutralBackground1).toBe('#E0F0FA');
  });

  it('leaves the built-ins unchanged when no overrides are configured', () => {
    const map = buildThemeMap({ default: 'dark' });
    expect(map.dark).toBe(webDarkTheme);
    expect(map.light).toBe(webLightTheme);
    // Sepia is the curated reading theme with its warm paper background.
    expect(map.sepia.colorNeutralBackground1).toBe('#F5ECD7');
  });
});
