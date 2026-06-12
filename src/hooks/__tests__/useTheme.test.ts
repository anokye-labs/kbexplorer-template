import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveInitialMode, readStoredRaw, buildThemeMap, nextTheme, modesForMap, isDarkTheme, BUILTIN_MODES } from '../useTheme';
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

  it('ignores an invalid brand seed instead of crashing', () => {
    const map = buildThemeMap({ default: 'dark', brand: 'not-a-color' });
    expect(map.dark).toBe(webDarkTheme);
    expect(map.light).toBe(webLightTheme);
  });

  it('ignores an empty brand ramp object', () => {
    const map = buildThemeMap({ default: 'dark', brand: {} });
    expect(map.dark).toBe(webDarkTheme);
  });

  it('does not let a custom theme overwrite a reserved built-in key', () => {
    const map = buildThemeMap({
      default: 'dark',
      themes: { dark: { brand: '#FF0000' } },
    });
    // The reserved 'dark' built-in is preserved, not replaced by the config theme.
    expect(map.dark).toBe(webDarkTheme);
  });
});

describe('modesForMap', () => {
  it('with no config themes the cycle is exactly dark/light/sepia', () => {
    const map = buildThemeMap({ default: 'dark' });
    expect(modesForMap(map)).toEqual(['dark', 'light', 'sepia']);
    expect(modesForMap(map)).toEqual(BUILTIN_MODES);
  });

  it('lists built-ins first, then config themes in config order', () => {
    const map = buildThemeMap({
      default: 'dark',
      themes: {
        ocean: { base: 'light', brand: '#1B6CA8' },
        forest: { base: 'dark', brand: '#2E7D32' },
      },
    });
    expect(modesForMap(map)).toEqual(['dark', 'light', 'sepia', 'ocean', 'forest']);
  });
});

describe('nextTheme', () => {
  it('cycles the built-ins and wraps around (default modes)', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('sepia');
    expect(nextTheme('sepia')).toBe('dark');
  });

  it('cycles built-ins + config themes and wraps around', () => {
    const modes = ['dark', 'light', 'sepia', 'ocean', 'forest'];
    expect(nextTheme('sepia', modes)).toBe('ocean');
    expect(nextTheme('ocean', modes)).toBe('forest');
    // Wrap from the last config theme back to the first built-in.
    expect(nextTheme('forest', modes)).toBe('dark');
  });

  it('resolves an unknown current mode to the first mode', () => {
    expect(nextTheme('gone', ['dark', 'light', 'sepia'])).toBe('dark');
  });
});

describe('isDarkTheme', () => {
  it('classifies the built-ins by background luminance', () => {
    const map = buildThemeMap({ default: 'dark' });
    expect(isDarkTheme(map.dark)).toBe(true);
    expect(isDarkTheme(map.light)).toBe(false);
    // Sepia is a warm light reading theme.
    expect(isDarkTheme(map.sepia)).toBe(false);
  });

  it('uses the resolved background, so a dark-based config theme with a light token override is light', () => {
    const map = buildThemeMap({
      default: 'dark',
      themes: {
        ocean: { base: 'dark', brand: '#1B6CA8', tokens: { colorNeutralBackground1: '#E0F0FA' } },
      },
    });
    // base: 'dark' but the explicit light background wins for isDark decisions.
    expect(isDarkTheme(map.ocean)).toBe(false);
  });
});

describe('readStored / resolveInitialMode against a dynamic set', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('accepts a valid stored config-theme key', () => {
    const modes = ['dark', 'light', 'sepia', 'ocean'];
    localStorage.setItem(STORAGE_KEY, 'ocean');
    expect(readStoredRaw(modes)).toBe('ocean');
    expect(resolveInitialMode('dark', modes)).toBe('ocean');
  });

  it('rejects a stale stored key not in the current set and falls back to config default', () => {
    // 'ocean' was removed from config, so the live set no longer contains it.
    const modes = ['dark', 'light', 'sepia'];
    localStorage.setItem(STORAGE_KEY, 'ocean');
    expect(readStoredRaw(modes)).toBeNull();
    expect(resolveInitialMode('light', modes)).toBe('light');
  });

  it('falls back to dark when the stale key has no valid config default', () => {
    const modes = ['dark', 'light', 'sepia'];
    localStorage.setItem(STORAGE_KEY, 'ocean');
    expect(resolveInitialMode(undefined, modes)).toBe('dark');
  });
});
