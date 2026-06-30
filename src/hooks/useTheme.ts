import { useState, useCallback } from 'react';
import type { KBConfig, FluentBrandRamp, FluentBrandRampKey } from '../types';
import {
  webDarkTheme,
  webLightTheme,
  createLightTheme,
  createDarkTheme,
  type Theme as FluentTheme,
  type BrandVariants,
} from '@fluentui/react-components';
import { generateBrandVariants } from '../theme/brandRamp';
import { resolveHostFluentTheme } from '../theme/hostTheme';

/**
 * Theme key for the host-inherited Fluent theme (#404). When the SPA is embedded
 * in a canvas host that mirrors semantic CSS vars (`--background-color-default`,
 * `--text-color-*`, `--font-*`), `applyConfig` resolves a Fluent theme from them
 * via {@link resolveHostFluentTheme} and registers it under this key so it joins
 * the selectable set / `t`-cycle and can be persisted like any other theme.
 */
export const INHERIT_HOST_MODE = 'inherit-host';

/**
 * A selectable theme key. The three built-ins (dark/light/sepia) are always
 * present; config-defined themes (`config.theme.themes.<name>`) widen this set
 * at runtime, so the type is intentionally open. `(string & {})` keeps built-in
 * autocomplete while still accepting arbitrary config theme keys.
 */
export type ThemeMode = 'dark' | 'light' | 'sepia' | (string & {});

const STORAGE_KEY = 'kbe-theme';

/** The always-present built-in themes, in canonical cycle order. */
export const BUILTIN_MODES: ThemeMode[] = ['dark', 'light', 'sepia'];

/**
 * Derive the ordered, selectable mode list from a runtime theme map: the
 * built-ins first (dark, light, sepia — only those actually present), then any
 * config-defined theme keys in config (insertion) order. This is the dynamic
 * equivalent of the old static `MODES` array and drives both the cycle order
 * and stored-key validation.
 */
export function modesForMap(themeMap: Record<string, FluentTheme>): ThemeMode[] {
  const keys = Object.keys(themeMap);
  const builtins = BUILTIN_MODES.filter(m => keys.includes(m as string));
  const extras = keys.filter(k => !(BUILTIN_MODES as string[]).includes(k));
  return [...builtins, ...extras];
}

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

/**
 * Returns the user's explicitly stored theme, or null when none is saved or the
 * saved key is not in the supplied selectable set. Validating against `modes`
 * means a stored config-theme key that no longer exists (e.g. the theme was
 * removed from config) is treated as absent rather than selected.
 */
export function readStoredRaw(modes: ThemeMode[] = BUILTIN_MODES): ThemeMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (modes as string[]).includes(v)) return v as ThemeMode;
  } catch { /* ignore */ }
  return null;
}

/**
 * Resolves the initial theme mode against the given selectable set. A theme the
 * user explicitly saved (and that is still valid) always wins; otherwise fall
 * back to config.theme.default (if valid), then to 'dark'.
 */
export function resolveInitialMode(
  configDefault?: ThemeMode,
  modes: ThemeMode[] = BUILTIN_MODES,
): ThemeMode {
  const stored = readStoredRaw(modes);
  if (stored) return stored;
  if (configDefault && (modes as string[]).includes(configDefault as string)) return configDefault;
  return (modes as string[]).includes('dark') ? 'dark' : (modes[0] ?? 'dark');
}

/**
 * Resolve a starting mode for the hook's initial state: a valid stored choice
 * wins, otherwise `fallback` (clamped to the selectable set).
 */
function readStored(modes: ThemeMode[] = BUILTIN_MODES, fallback: ThemeMode = 'dark'): ThemeMode {
  return readStoredRaw(modes) ?? ((modes as string[]).includes(fallback as string) ? fallback : (modes[0] ?? 'dark'));
}

/**
 * The three always-present built-in themes. With no config overrides this is
 * the entire theme map, so default (no brand/tokens/themes) behavior is byte-
 * for-byte identical to the previous static map.
 */
const BUILTIN_THEME_MAP: Record<'dark' | 'light' | 'sepia', FluentTheme> = {
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
      if ((BUILTIN_MODES as string[]).includes(key)) {
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
  (theme?: KBConfig['theme'], moduleThemes?: Record<string, FluentTheme>) => void,
  () => void,
  ThemeMode[],
] {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored());
  const [themeMap, setThemeMap] = useState<Record<string, FluentTheme>>(BUILTIN_THEME_MAP);

  const setMode = useCallback((t: ThemeMode) => {
    setModeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);

  // Invoked once config resolves (async, after mount). Builds the dynamic theme
  // map from config and reconciles the active mode against the new selectable
  // set: a still-valid stored choice wins; a stale stored key (e.g. a config
  // theme that was removed) is ignored and we fall back to config.theme.default
  // then 'dark'. The default is not persisted, so a later config change can
  // still take effect.
  //
  // `moduleThemes` (T5.3) are fully-built Fluent themes resolved from a custom
  // host JS module (config.theme.moduleUrl). They are the MOST SPECIFIC escape
  // hatch, so they are spread LAST and override built-ins/config themes of the
  // same name. Absent/empty ⇒ the map equals the config-only result (no-op).
  const applyConfig = useCallback((theme?: KBConfig['theme'], moduleThemes?: Record<string, FluentTheme>) => {
    const map = { ...buildThemeMap(theme), ...(moduleThemes ?? {}) };
    // #404: when embedded in a canvas host that mirrors semantic CSS vars, adopt
    // its look by resolving a Fluent theme from those vars (with the published
    // PresentationTokens intent knobs from config). Registered last so a real
    // host theme is always available; absent host vars ⇒ null ⇒ no-op.
    const hostPresentation = (theme as { presentation?: import('@anokye-labs/kbexplorer-core').PresentationTokens } | undefined)?.presentation;
    const hostTheme = resolveHostFluentTheme(
      typeof document !== 'undefined' ? document.documentElement : null,
      hostPresentation,
    );
    if (hostTheme) map[INHERIT_HOST_MODE] = hostTheme;
    setThemeMap(map);
    const modes = modesForMap(map);
    const stored = readStoredRaw(modes);
    if (stored !== null) {
      setModeState(stored);
      return;
    }
    const configDefault = theme?.default;
    if (configDefault && (modes as string[]).includes(configDefault as string)) {
      setModeState(configDefault);
    } else {
      setModeState((modes as string[]).includes('dark') ? 'dark' : (modes[0] ?? 'dark'));
    }
  }, []);

  // Cycle to the next theme based on the live map keys (built-ins + config
  // themes), wrapping around. Persists the choice like an explicit selection.
  const cycleTheme = useCallback(() => {
    const modes = modesForMap(themeMap);
    setModeState(prev => {
      const next = nextTheme(prev, modes);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, [themeMap]);

  const fluentTheme =
    themeMap[mode] ?? (BUILTIN_THEME_MAP as Record<string, FluentTheme>)[mode] ?? webDarkTheme;

  // The full selectable set (built-ins first, then config/external/module
  // themes) so the UI can render a theme chooser, not just the `t` cycle.
  const availableModes = modesForMap(themeMap);

  return [mode, fluentTheme, setMode, applyConfig, cycleTheme, availableModes];
}

/**
 * Return the next theme in the cycle after `current`, wrapping around. The
 * cycle is the supplied `modes` list (built-ins first, then config themes); an
 * unknown `current` (not in the set) resolves to the first mode.
 */
export function nextTheme(current: ThemeMode, modes: ThemeMode[] = BUILTIN_MODES): ThemeMode {
  if (modes.length === 0) return current;
  const i = modes.indexOf(current);
  return modes[(i + 1) % modes.length];
}

/**
 * Whether a resolved Fluent theme renders on a dark background, derived from
 * the perceived luminance of `colorNeutralBackground1`. Used instead of a
 * `mode === 'dark'` string check so config themes (any key) drive dark/light
 * UI decisions correctly. Defaults to dark when the background is unparseable.
 */
export function isDarkTheme(theme: FluentTheme): boolean {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(theme.colorNeutralBackground1 ?? '');
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
