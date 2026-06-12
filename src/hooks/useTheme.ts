import { useState, useCallback } from 'react';
import type { Theme, KBConfig, FluentBrandRamp, FluentBrandRampKey } from '../types';
import {
  webDarkTheme,
  webLightTheme,
  createLightTheme,
  createDarkTheme,
  type Theme as FluentTheme,
  type BrandVariants,
} from '@fluentui/react-components';
import { generateBrandVariants } from '../theme/brandRamp';

export type ThemeMode = 'dark' | 'light' | 'sepia';

const STORAGE_KEY = 'kbe-theme';
const MODES: ThemeMode[] = ['dark', 'light', 'sepia'];

// Warm amber brand ramp for the sepia reading theme
const sepiaBrand: BrandVariants = {
  10: '#1C1308',
  20: '#2E2010',
  30: '#422E16',
  40: '#553C1C',
  50: '#6A4B22',
  60: '#7F5B29',
  70: '#956C30',
  80: '#A87D3A',
  90: '#B88E4E',
  100: '#C79F63',
  110: '#D4B07A',
  120: '#E0C192',
  130: '#EAD1AB',
  140: '#F2E1C5',
  150: '#F8EFDF',
  160: '#FCF7F0',
};

const sepiaTheme: FluentTheme = {
  ...createLightTheme(sepiaBrand),
  // Warm paper-like backgrounds
  colorNeutralBackground1: '#F5ECD7',
  colorNeutralBackground2: '#EDE4CC',
  colorNeutralBackground3: '#E5DBC2',
  colorNeutralBackground4: '#DDD2B8',
  colorNeutralBackground5: '#D5C9AE',
  colorNeutralBackground6: '#CFC3A6',
  // Warm dark text for contrast
  colorNeutralForeground1: '#2A2520',
  colorNeutralForeground2: '#4A4238',
  colorNeutralForeground3: '#7A7068',
  colorNeutralForeground4: '#9A8E80',
  // Card backgrounds
  colorNeutralCardBackground: '#F8F0DC',
  colorNeutralCardBackgroundHover: '#FBF5E8',
  colorNeutralCardBackgroundPressed: '#F0E6CE',
  // Strokes
  colorNeutralStroke1: '#D0C4A8',
  colorNeutralStroke2: '#DDD2B8',
  colorNeutralStroke3: '#E8DEC8',
  // Subtle backgrounds
  colorSubtleBackground: 'transparent',
  colorSubtleBackgroundHover: '#EDE4CC',
  colorSubtleBackgroundPressed: '#E5DBC2',
};

/** Returns the user's explicitly stored theme, or null when none is saved. */
export function readStoredRaw(): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && MODES.includes(v as ThemeMode)) return v as ThemeMode;
  } catch { /* ignore */ }
  return null;
}

/**
 * Resolves the initial theme mode. A theme the user explicitly saved always
 * wins; otherwise fall back to config.theme.default, then to 'dark'.
 */
export function resolveInitialMode(configDefault?: Theme): ThemeMode {
  const stored = readStoredRaw();
  if (stored) return stored;
  if (configDefault && MODES.includes(configDefault)) return configDefault;
  return 'dark';
}

function readStored(): ThemeMode {
  return readStoredRaw() ?? 'dark';
}

/**
 * The three always-present built-in themes. With no config overrides this is
 * the entire theme map, so default (no brand/tokens/themes) behavior is byte-
 * for-byte identical to the previous static map.
 */
const BUILTIN_THEME_MAP: Record<ThemeMode, FluentTheme> = {
  dark: webDarkTheme,
  light: webLightTheme,
  sepia: sepiaTheme,
};

// Brand ramp stops in ascending order, used to fill a partial ramp object.
const RAMP_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;

/**
 * Convert a config brand ramp object (string keys "10".."160", possibly
 * partial) into a complete Fluent `BrandVariants`. A complete ramp is used
 * verbatim; a partial ramp has its gaps filled by carrying the nearest
 * provided neighbor (forward, then backward) so every stop is defined.
 * Returns `undefined` for an empty ramp (no stops provided) so callers can
 * ignore an invalid brand rather than feed an incomplete ramp into
 * `createDarkTheme`/`createLightTheme`.
 */
function rampToBrandVariants(ramp: FluentBrandRamp): BrandVariants | undefined {
  const out: Record<number, string> = {};
  for (const stop of RAMP_STOPS) {
    const value = ramp[String(stop) as FluentBrandRampKey];
    if (value) out[stop] = value;
  }
  if (Object.keys(out).length === 0) return undefined;
  let last: string | undefined;
  for (const stop of RAMP_STOPS) {
    if (out[stop]) last = out[stop];
    else if (last) out[stop] = last;
  }
  let next: string | undefined;
  for (let i = RAMP_STOPS.length - 1; i >= 0; i--) {
    const stop = RAMP_STOPS[i];
    if (out[stop]) next = out[stop];
    else if (next) out[stop] = next;
  }
  return out as BrandVariants;
}

/**
 * Resolve a config brand value (seed hex or ramp object) to BrandVariants.
 * Returns `undefined` for an invalid hex seed or an empty ramp so a bad
 * `config.theme.brand` is ignored (config.yaml is merged without validation)
 * instead of crashing the app.
 */
function resolveBrandVariants(brand: string | FluentBrandRamp): BrandVariants | undefined {
  try {
    return typeof brand === 'string' ? generateBrandVariants(brand) : rampToBrandVariants(brand);
  } catch {
    return undefined;
  }
}

/** Spread arbitrary token overrides over a Theme so explicit values win. */
function applyTokens(base: FluentTheme, tokens?: Partial<Record<string, string>>): FluentTheme {
  if (!tokens) return base;
  return { ...base, ...tokens } as FluentTheme;
}

/**
 * Build the runtime theme map from config. Pure and side-effect free.
 *
 * - Starts from the three built-ins (dark/light/sepia).
 * - A global `theme.brand` regenerates the dark/light base themes via
 *   `createDarkTheme`/`createLightTheme`; `theme.tokens` are then spread on top.
 * - Each `theme.themes.<name>` entry is registered under its name (built-in
 *   names dark/light/sepia are reserved and skipped with a warning), derived
 *   from its `base` ('dark'→createDarkTheme, 'light'→createLightTheme, default
 *   'dark'), its `brand`, and its `tokens`.
 *
 * With no brand/tokens/themes configured the dark/light/sepia entries reuse the
 * built-in theme object references, so behavior is unchanged. (The returned map
 * is always a fresh object literal — only its theme *values* are shared.)
 */
export function buildThemeMap(theme?: KBConfig['theme']): Record<string, FluentTheme> {
  const globalVariants = theme?.brand ? resolveBrandVariants(theme.brand) : undefined;
  const globalTokens = theme?.tokens;

  const dark = applyTokens(globalVariants ? createDarkTheme(globalVariants) : webDarkTheme, globalTokens);
  const light = applyTokens(globalVariants ? createLightTheme(globalVariants) : webLightTheme, globalTokens);

  const map: Record<string, FluentTheme> = { dark, light, sepia: sepiaTheme };

  if (theme?.themes) {
    for (const [key, def] of Object.entries(theme.themes)) {
      if ((MODES as string[]).includes(key)) {
        console.warn(
          `[useTheme] Ignoring config theme "${key}": that name is reserved for a built-in theme.`,
        );
        continue;
      }
      const base = def.base ?? 'dark';
      const variants = def.brand ? resolveBrandVariants(def.brand) : undefined;
      let baseTheme: FluentTheme;
      if (variants) {
        baseTheme = base === 'light' ? createLightTheme(variants) : createDarkTheme(variants);
      } else {
        baseTheme = base === 'light' ? webLightTheme : webDarkTheme;
      }
      map[key] = applyTokens(baseTheme, def.tokens);
    }
  }

  return map;
}

export function useTheme(): [
  ThemeMode,
  FluentTheme,
  (t: ThemeMode) => void,
  (theme?: KBConfig['theme']) => void,
] {
  const [mode, setModeState] = useState<ThemeMode>(readStored);
  const [themeMap, setThemeMap] = useState<Record<string, FluentTheme>>(BUILTIN_THEME_MAP);

  const setMode = useCallback((t: ThemeMode) => {
    setModeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  // Invoked once config resolves (async, after mount). Builds the dynamic theme
  // map from config and applies config.theme.default as the initial mode — but
  // never overrides a theme the user has explicitly saved. The default is not
  // persisted, so a later config change can still take effect.
  const applyConfig = useCallback((theme?: KBConfig['theme']) => {
    setThemeMap(buildThemeMap(theme));
    if (readStoredRaw() !== null) return;
    const configDefault = theme?.default;
    if (configDefault && MODES.includes(configDefault)) {
      setModeState(configDefault);
    }
  }, []);

  const fluentTheme = themeMap[mode] ?? BUILTIN_THEME_MAP[mode] ?? webDarkTheme;

  return [mode, fluentTheme, setMode, applyConfig];
}

export function nextTheme(current: ThemeMode): ThemeMode {
  const i = MODES.indexOf(current);
  return MODES[(i + 1) % MODES.length];
}
