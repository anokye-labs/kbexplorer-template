/**
 * Custom JS theme-module loader (F5 / T5.3 — issue #201).
 *
 * The most powerful theming escape hatch: a HOST repo can ship its OWN ESM
 * JavaScript module that exports a fully-built Fluent `Theme` (or a
 * `BrandVariants` / seed hex this turns into a Theme via `generateBrandVariants`)
 * and kbexplorer dynamically `import()`s it at runtime and registers the result
 * into the dynamic THEME_MAP. This gives full programmatic theme control without
 * touching the `.kbexplorer` submodule or expressing everything in YAML.
 *
 * SECURITY: dynamically importing host-provided JavaScript executes arbitrary
 * code in the page. It is therefore gated behind an EXPLICIT, off-by-default
 * opt-in (`config.theme.moduleUrl`) and ships with a CSP/trust note in the
 * theming docs. Default unset ⇒ no import, a pure no-op. See the docs for the
 * `script-src` / `connect-src` implications and the recommendation to self-host
 * the module in the same repo you already trust.
 *
 * This file mirrors `src/engine/plugin-loader.ts` (the custom-provider plugin
 * pattern): dynamic import, shape validation, and a SINGLE clear `console.warn`
 * with a no-op fallback on ANY failure (network, bad module, wrong shape) — the
 * THEME_MAP is simply left unchanged.
 *
 * Everything except the network `import()` is pure and side-effect free (aside
 * from diagnostic warnings), and the importer is injected so the loader is
 * unit-testable in the node vitest environment against a LOCAL FIXTURE module.
 */
import {
  createDarkTheme,
  createLightTheme,
  type Theme as FluentTheme,
  type BrandVariants,
} from '@fluentui/react-components';
import { generateBrandVariants } from './brandRamp';

/** The default name a module-provided theme is registered under when unnamed. */
export const DEFAULT_MODULE_THEME_NAME = 'custom';

/** The 16 Fluent brand ramp stops a `BrandVariants` object must define. */
const BRAND_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;

/** Whether a value is a non-null, non-array plain object. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Whether `v` looks like a Fluent `Theme`: a plain object carrying the core
 * neutral tokens every Fluent theme defines as strings. This is a structural
 * (duck-typed) check rather than a deep one — enough to distinguish a real
 * theme from a `BrandVariants` ramp, config object, or arbitrary garbage
 * without coupling to Fluent's full ~150-token surface.
 */
export function isFluentTheme(v: unknown): v is FluentTheme {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.colorNeutralBackground1 === 'string' &&
    typeof v.colorNeutralForeground1 === 'string' &&
    typeof v.colorBrandBackground === 'string'
  );
}

/**
 * Whether `v` looks like a Fluent `BrandVariants` ramp: a plain object defining
 * the 16 numeric stop keys (10..160) as hex-ish strings. Checked structurally
 * so a module can export a ramp (or seed) instead of a fully-built Theme.
 */
export function isBrandVariants(v: unknown): v is BrandVariants {
  if (!isPlainObject(v)) return false;
  return BRAND_STOPS.every(stop => typeof (v as Record<number, unknown>)[stop] === 'string');
}

/** Coerce an exported `base` value to a valid base mode, defaulting to 'dark'. */
function resolveBase(base: unknown): 'dark' | 'light' {
  return base === 'light' ? 'light' : 'dark';
}

/**
 * Build a Fluent `Theme` from a brand value (a seed hex string or a complete
 * `BrandVariants` ramp) on the requested base. Returns `null` for an invalid
 * seed so a bad export is ignored rather than crashing. Pure.
 */
export function themeFromBrand(
  brand: string | BrandVariants,
  base: 'dark' | 'light' = 'dark',
): FluentTheme | null {
  let variants: BrandVariants;
  if (typeof brand === 'string') {
    try {
      variants = generateBrandVariants(brand);
    } catch {
      return null;
    }
  } else if (isBrandVariants(brand)) {
    variants = brand;
  } else {
    return null;
  }
  return base === 'light' ? createLightTheme(variants) : createDarkTheme(variants);
}

/**
 * Resolve the module namespace object exported by a host theme module into a
 * map of named Fluent themes ready to merge into the THEME_MAP. Pure.
 *
 * Supported export shapes, in priority order:
 *   1. `themes`     — a record of name → Theme (each validated); names are kept.
 *   2. `theme`      — a single Theme, registered under the resolved name.
 *   3. default      — a single Theme, registered under the resolved name.
 *   4. `brandVariants` / `brand` / `seed` — a BrandVariants ramp or seed hex,
 *      turned into a Theme on the module's `base` ('dark' default).
 *   5. default      — a BrandVariants ramp, turned into a Theme.
 *
 * The single-theme name is: the module's own `name` export (if a string), else
 * the caller-supplied `name`, else {@link DEFAULT_MODULE_THEME_NAME}.
 *
 * Returns `null` when nothing usable is exported, so the loader can warn once
 * and leave the THEME_MAP unchanged.
 */
export function resolveThemeModule(
  mod: unknown,
  name: string = DEFAULT_MODULE_THEME_NAME,
): Record<string, FluentTheme> | null {
  if (!isPlainObject(mod)) return null;

  // 1. A record of named themes — register every valid entry under its key.
  if (isPlainObject(mod.themes)) {
    const out: Record<string, FluentTheme> = {};
    for (const [key, value] of Object.entries(mod.themes)) {
      if (isFluentTheme(value)) out[key] = value;
    }
    if (Object.keys(out).length > 0) return out;
  }

  const resolvedName = typeof mod.name === 'string' && mod.name.trim() ? mod.name.trim() : name;
  const base = resolveBase(mod.base);

  // 2-3. A single, fully-built Theme (named or default export).
  if (isFluentTheme(mod.theme)) return { [resolvedName]: mod.theme };
  if (isFluentTheme(mod.default)) return { [resolvedName]: mod.default };

  // 4. A BrandVariants ramp or seed hex this can build into a Theme.
  if (isBrandVariants(mod.brandVariants)) {
    const t = themeFromBrand(mod.brandVariants, base);
    if (t) return { [resolvedName]: t };
  }
  if (typeof mod.brand === 'string' || isBrandVariants(mod.brand)) {
    const t = themeFromBrand(mod.brand as string | BrandVariants, base);
    if (t) return { [resolvedName]: t };
  }
  if (typeof mod.seed === 'string') {
    const t = themeFromBrand(mod.seed, base);
    if (t) return { [resolvedName]: t };
  }

  // 5. A default-exported BrandVariants ramp.
  if (isBrandVariants(mod.default)) {
    const t = themeFromBrand(mod.default, base);
    if (t) return { [resolvedName]: t };
  }

  return null;
}

/** An `import()`-like function. Injected so the loader is testable with a fixture. */
export type ModuleImporter = (url: string) => Promise<unknown>;

/** Default importer: a real dynamic `import()`. `@vite-ignore` keeps the URL runtime-dynamic. */
const defaultImporter: ModuleImporter = (url: string) => import(/* @vite-ignore */ url);

/** Options for {@link loadThemeModule}. */
export interface LoadThemeModuleOptions {
  /** Name to register a single (unnamed) module theme under. Defaults to 'custom'. */
  name?: string;
  /** Injectable `import()` for tests; defaults to a real dynamic import. */
  importer?: ModuleImporter;
}

/**
 * Dynamically import the host theme module at `moduleUrl`, validate its exports,
 * and return a map of named Fluent themes to merge into the THEME_MAP.
 *
 * Returns `null` — a safe no-op fallback that leaves the THEME_MAP unchanged —
 * when `moduleUrl` is unset (the default, pure no-op), the import fails
 * (network/parse/MIME error), or the module exports nothing this can turn into a
 * Theme. On any failure it emits at most a SINGLE `console.warn`; it never throws.
 *
 * Mirrors `loadExternalProviders`' custom-provider stub: one clear warning, then
 * fall back to leaving the registry/map alone.
 */
export async function loadThemeModule(
  moduleUrl: string | undefined,
  options: LoadThemeModuleOptions = {},
): Promise<Record<string, FluentTheme> | null> {
  if (!moduleUrl) return null;
  const { name = DEFAULT_MODULE_THEME_NAME, importer = defaultImporter } = options;

  let mod: unknown;
  try {
    mod = await importer(moduleUrl);
  } catch {
    console.warn(
      `[themeModule] Could not import theme module "${moduleUrl}" — using built-in/config themes only.`,
    );
    return null;
  }

  const themes = resolveThemeModule(mod, name);
  if (!themes) {
    console.warn(
      `[themeModule] Theme module "${moduleUrl}" did not export a usable Fluent Theme / BrandVariants — ignoring it.`,
    );
    return null;
  }
  return themes;
}

/**
 * Orchestrate applying a theme config that may opt into a custom JS theme module
 * (T5.3), in the correct ORDER so the UI never lingers on the built-in map:
 *
 *   1. Apply the config-only map IMMEDIATELY (synchronously), so a slow or
 *      failing module import never delays the config themes.
 *   2. Then `load()` the module (independently — no serial round-trip) and, only
 *      if it resolves to usable themes, RE-APPLY the merged map on top.
 *
 * `load` is expected to be no-throw (see {@link loadThemeModule}); a rejection or
 * a null result simply leaves the config-only map from step 1 in place. The
 * caller supplies `apply` already guarded against unmount/cancellation if needed.
 *
 * Returns a promise that resolves once the (optional) re-apply has run, so tests
 * can await the full ordering.
 */
export async function applyThemeModuleInOrder<T>(
  theme: T,
  load: () => Promise<Record<string, FluentTheme> | null>,
  apply: (theme: T, moduleThemes?: Record<string, FluentTheme>) => void,
): Promise<void> {
  apply(theme);
  let moduleThemes: Record<string, FluentTheme> | null;
  try {
    moduleThemes = await load();
  } catch {
    return;
  }
  if (moduleThemes) apply(theme, moduleThemes);
}
