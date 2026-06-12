/**
 * External theme file support (F5 / T5.1 — issue #199).
 *
 * Lets a HOST repo define or override named themes from a *dedicated* file
 * (pointed at by `config.theme.themesFile`) instead of editing the
 * `.kbexplorer` submodule or stuffing everything into config.yaml. The file is
 * fetched at runtime exactly like config.yaml (same source/auth in remote mode,
 * the pre-built manifest in local mode), parsed here, and merged into the
 * config's theme block before `buildThemeMap`/`applyConfig` consume it.
 *
 * Everything here is pure and side-effect free (aside from a single `console.warn`
 * on a failed load), so the parse/merge helpers are unit-testable in the node
 * vitest environment without any DOM or React rendering. The async `loadExternalTheme`
 * takes its fetch function as a parameter so it can be tested against a mock.
 *
 * T5.3 (#201, custom JS theme-module loader) builds on this same flow, so the
 * loader and merge helpers are kept clean and exported.
 */
import yaml from 'yaml';
import type { KBConfig, FluentBrandRamp } from '../types';

/** A single named theme variant, mirroring `config.theme.themes.<name>`. */
export interface ExternalThemeVariant {
  brand?: string | FluentBrandRamp;
  tokens?: Partial<Record<string, string>>;
  base?: 'dark' | 'light';
}

/**
 * The parsed shape of an external theme file. It mirrors the relevant subset of
 * `config.theme`: an optional default mode, optional global brand/tokens, and a
 * map of named theme variants. All fields are optional so a file may contribute
 * only `themes`, only a global `brand`, etc.
 */
export interface ExternalThemeFile {
  default?: string;
  brand?: string | FluentBrandRamp;
  tokens?: Partial<Record<string, string>>;
  themes?: Record<string, ExternalThemeVariant>;
}

/** Whether a value is a non-null, non-array plain object. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse the raw YAML of an external theme file into an `ExternalThemeFile`.
 *
 * Returns `null` when the input is malformed in a way that can't yield any
 * usable theme data: a YAML parse error, a non-object document (string, number,
 * array, null), or a `themes` value that isn't an object. Recognized-but-empty
 * input (e.g. `{}`) parses to an empty object rather than `null`. Individual
 * unknown/garbage keys are ignored rather than rejected, matching the lenient,
 * validation-free merge that config.yaml itself receives.
 */
export function parseExternalTheme(raw: string): ExternalThemeFile | null {
  let doc: unknown;
  try {
    doc = yaml.parse(raw);
  } catch {
    console.warn('[externalTheme] Failed to parse external theme file as YAML — ignoring it.');
    return null;
  }

  if (!isPlainObject(doc)) {
    // null/empty document, or a scalar/array at the top level — nothing usable.
    if (doc == null) return null;
    console.warn('[externalTheme] External theme file is not a mapping — ignoring it.');
    return null;
  }

  const out: ExternalThemeFile = {};

  if (typeof doc.default === 'string') out.default = doc.default;
  if (typeof doc.brand === 'string' || isPlainObject(doc.brand)) {
    out.brand = doc.brand as string | FluentBrandRamp;
  }
  if (isPlainObject(doc.tokens)) {
    out.tokens = doc.tokens as Partial<Record<string, string>>;
  }

  if ('themes' in doc && doc.themes != null) {
    if (!isPlainObject(doc.themes)) {
      console.warn('[externalTheme] External theme file "themes" is not a mapping — ignoring it.');
      return null;
    }
    const themes: Record<string, ExternalThemeVariant> = {};
    for (const [key, value] of Object.entries(doc.themes)) {
      if (!isPlainObject(value)) continue;
      const variant: ExternalThemeVariant = {};
      if (typeof value.brand === 'string' || isPlainObject(value.brand)) {
        variant.brand = value.brand as string | FluentBrandRamp;
      }
      if (isPlainObject(value.tokens)) {
        variant.tokens = value.tokens as Partial<Record<string, string>>;
      }
      if (value.base === 'dark' || value.base === 'light') {
        variant.base = value.base;
      }
      themes[key] = variant;
    }
    out.themes = themes;
  }

  return out;
}

/** Field-level merge of one theme variant; `external` wins on every field it provides. */
function mergeVariant(
  base: ExternalThemeVariant | undefined,
  external: ExternalThemeVariant,
): ExternalThemeVariant {
  if (!base) return external;
  return {
    base: external.base ?? base.base,
    brand: external.brand ?? base.brand,
    tokens:
      external.tokens || base.tokens
        ? { ...base.tokens, ...external.tokens }
        : undefined,
  };
}

/**
 * Merge an external theme file into a config theme block. Pure: returns a fresh
 * theme object and never mutates either input.
 *
 * Precedence — the external file is the more specific escape hatch, so it WINS:
 *   - Top-level `default` / `brand`: the external value replaces the config one
 *     when present; otherwise the config value is kept.
 *   - Top-level `tokens`: shallow-merged with external keys winning.
 *   - `themes.<name>`: for a name present in both, the entry is field-merged
 *     (external `brand`/`base` win, `tokens` shallow-merged external-wins);
 *     names only in the external file are added; names only in config are kept.
 *
 * A nullish/undefined `external` (no file, or a file that failed to load/parse)
 * returns the original config theme unchanged.
 */
export function mergeExternalTheme(
  configTheme: KBConfig['theme'],
  external: ExternalThemeFile | null | undefined,
): KBConfig['theme'] {
  if (!external) return configTheme;

  const mergedThemes: KBConfig['theme']['themes'] = { ...configTheme.themes };
  if (external.themes) {
    for (const [key, variant] of Object.entries(external.themes)) {
      mergedThemes[key] = mergeVariant(mergedThemes[key], variant);
    }
  }

  return {
    ...configTheme,
    default: (external.default ?? configTheme.default) as KBConfig['theme']['default'],
    brand: external.brand ?? configTheme.brand,
    tokens:
      external.tokens || configTheme.tokens
        ? { ...configTheme.tokens, ...external.tokens }
        : undefined,
    themes: Object.keys(mergedThemes).length > 0 ? mergedThemes : undefined,
  };
}

/**
 * Load and parse the external theme file referenced by `themesFile`, using the
 * supplied `fetchRaw` to read the raw text (so callers wire in the remote
 * `fetchFile` or a local-manifest reader, and tests pass a mock).
 *
 * Returns `null` — a safe no-op fallback — when `themesFile` is unset, the fetch
 * rejects (missing/unreachable file), or the content is malformed. A failed
 * fetch warns at most; it never throws.
 */
export async function loadExternalTheme(
  themesFile: string | undefined,
  fetchRaw: (path: string) => Promise<string>,
): Promise<ExternalThemeFile | null> {
  if (!themesFile) return null;
  let raw: string;
  try {
    raw = await fetchRaw(themesFile);
  } catch {
    console.warn(
      `[externalTheme] Could not load theme file "${themesFile}" — using config themes only.`,
    );
    return null;
  }
  return parseExternalTheme(raw);
}

/**
 * Convenience wrapper: fetch + parse + merge the external theme file into a
 * config's theme block, returning a new `KBConfig['theme']`. When `themesFile`
 * is unset or the file can't be loaded/parsed, the config theme is returned
 * unchanged. Used by the remote/local loaders so the merged map is what
 * `buildThemeMap`/`applyConfig` consume.
 */
export async function applyExternalThemeFile(
  configTheme: KBConfig['theme'],
  fetchRaw: (path: string) => Promise<string>,
): Promise<KBConfig['theme']> {
  const external = await loadExternalTheme(configTheme?.themesFile, fetchRaw);
  return mergeExternalTheme(configTheme, external);
}
