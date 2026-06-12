import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDarkTheme, type Theme, type BrandVariants } from '@fluentui/react-components';
import {
  isFluentTheme,
  isBrandVariants,
  themeFromBrand,
  resolveThemeModule,
  loadThemeModule,
  DEFAULT_MODULE_THEME_NAME,
} from '../themeModule';
import { generateBrandVariants } from '../brandRamp';

// Pure-function + injected-importer tests only (node env, no jsdom / React).
// Covers the custom JS theme-module loader: shape validation, the resolver's
// supported export shapes, the local-fixture happy path, and the warn+no-op
// failure path.

/** A real, fully-built Fluent Theme for use as a valid module export. */
const sampleTheme: Theme = createDarkTheme(generateBrandVariants('#4A9CC8'));
const sampleBrand: BrandVariants = generateBrandVariants('#C8102E');

describe('isFluentTheme', () => {
  it('accepts a real Fluent theme', () => {
    expect(isFluentTheme(sampleTheme)).toBe(true);
  });

  it('rejects BrandVariants, plain objects, and non-objects', () => {
    expect(isFluentTheme(sampleBrand)).toBe(false);
    expect(isFluentTheme({ foo: 'bar' })).toBe(false);
    expect(isFluentTheme(null)).toBe(false);
    expect(isFluentTheme('#fff')).toBe(false);
    expect(isFluentTheme([sampleTheme])).toBe(false);
  });
});

describe('isBrandVariants', () => {
  it('accepts a complete 16-stop ramp', () => {
    expect(isBrandVariants(sampleBrand)).toBe(true);
  });

  it('rejects a Fluent theme, partial ramps, and non-objects', () => {
    expect(isBrandVariants(sampleTheme)).toBe(false);
    expect(isBrandVariants({ 10: '#000', 80: '#888' })).toBe(false);
    expect(isBrandVariants(null)).toBe(false);
  });
});

describe('themeFromBrand', () => {
  it('builds a Theme from a seed hex (dark by default)', () => {
    const t = themeFromBrand('#2E7D32');
    expect(t).not.toBeNull();
    expect(isFluentTheme(t)).toBe(true);
  });

  it('builds a light Theme when base is light', () => {
    const dark = themeFromBrand(sampleBrand, 'dark')!;
    const light = themeFromBrand(sampleBrand, 'light')!;
    expect(dark.colorNeutralBackground1).not.toEqual(light.colorNeutralBackground1);
  });

  it('builds a Theme from a BrandVariants ramp', () => {
    expect(isFluentTheme(themeFromBrand(sampleBrand))).toBe(true);
  });

  it('returns null for an invalid seed', () => {
    expect(themeFromBrand('not-a-color')).toBeNull();
  });
});

describe('resolveThemeModule', () => {
  it('resolves a single named `theme` export under the module name', () => {
    const out = resolveThemeModule({ name: 'forest', theme: sampleTheme });
    expect(out).toEqual({ forest: sampleTheme });
  });

  it('falls back to the supplied name when the module is unnamed', () => {
    const out = resolveThemeModule({ theme: sampleTheme }, 'brandX');
    expect(out).toEqual({ brandX: sampleTheme });
  });

  it('defaults to DEFAULT_MODULE_THEME_NAME with no name anywhere', () => {
    const out = resolveThemeModule({ theme: sampleTheme });
    expect(Object.keys(out!)).toEqual([DEFAULT_MODULE_THEME_NAME]);
  });

  it('resolves a `themes` record of named themes', () => {
    const other = createDarkTheme(generateBrandVariants('#E8A838'));
    const out = resolveThemeModule({ themes: { a: sampleTheme, b: other } });
    expect(out).toEqual({ a: sampleTheme, b: other });
  });

  it('skips invalid entries inside a `themes` record', () => {
    const out = resolveThemeModule({ themes: { good: sampleTheme, bad: { foo: 1 } } });
    expect(out).toEqual({ good: sampleTheme });
  });

  it('resolves a default-exported Theme', () => {
    const out = resolveThemeModule({ default: sampleTheme }, 'custom');
    expect(out).toEqual({ custom: sampleTheme });
  });

  it('builds a Theme from a `brand` seed export honoring `base`', () => {
    const out = resolveThemeModule({ name: 'crimson', brand: '#C8102E', base: 'light' });
    expect(Object.keys(out!)).toEqual(['crimson']);
    expect(isFluentTheme(out!.crimson)).toBe(true);
  });

  it('builds a Theme from a `brandVariants` export', () => {
    const out = resolveThemeModule({ brandVariants: sampleBrand }, 'ramp');
    expect(isFluentTheme(out!.ramp)).toBe(true);
  });

  it('builds a Theme from a `seed` export', () => {
    const out = resolveThemeModule({ seed: '#2E7D32' }, 'seeded');
    expect(isFluentTheme(out!.seeded)).toBe(true);
  });

  it('returns null for wrong-shape / empty modules', () => {
    expect(resolveThemeModule({ foo: 'bar' })).toBeNull();
    expect(resolveThemeModule({ brand: 'not-a-color' })).toBeNull();
    expect(resolveThemeModule(null)).toBeNull();
    expect(resolveThemeModule('nope')).toBeNull();
  });
});

describe('loadThemeModule', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('is a pure no-op (no warning, no import) when moduleUrl is unset', async () => {
    const importer = vi.fn();
    const out = await loadThemeModule(undefined, { importer });
    expect(out).toBeNull();
    expect(importer).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('imports a LOCAL FIXTURE module and registers its Theme', async () => {
    const out = await loadThemeModule('virtual:fixture', {
      importer: () => import('./fixtures/themeModule.good'),
    });
    expect(out).not.toBeNull();
    // The fixture exports name='fixture-forest' and a recoloured Theme.
    expect(Object.keys(out!)).toEqual(['fixture-forest']);
    expect(isFluentTheme(out!['fixture-forest'])).toBe(true);
    expect(out!['fixture-forest'].colorNeutralBackground1).toBe('#0B1A0B');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('honors the configured name for an unnamed module', async () => {
    const out = await loadThemeModule('virtual:x', {
      name: 'myTheme',
      importer: async () => ({ theme: sampleTheme }),
    });
    expect(Object.keys(out!)).toEqual(['myTheme']);
  });

  it('warns once and is a no-op when the import fails (network/MIME/parse)', async () => {
    const out = await loadThemeModule('https://example.invalid/theme.js', {
      importer: () => Promise.reject(new Error('network')),
    });
    expect(out).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('Could not import theme module');
  });

  it('warns once and is a no-op when the module exports the wrong shape', async () => {
    const out = await loadThemeModule('virtual:bad', {
      importer: async () => ({ notATheme: true, color: '#fff' }),
    });
    expect(out).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('did not export a usable Fluent Theme');
  });
});
