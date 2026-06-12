/**
 * Per-page (per-node) theme deltas.
 *
 * A node may declare page-level theming in its frontmatter (see `PageTheme` in
 * `../types`). This module turns that declaration into a set of Fluent token
 * deltas — and then into a scoped CSS-variable style object — so ReadingView
 * can restyle ONLY the current page without mutating the global theme or the
 * document root. It reuses the same scoped-CSS-var mechanism as cluster tokens
 * (T4.1): setting `--<token>` on a container shadows that Fluent token for the
 * subtree, and navigating away simply unmounts the container, restoring the
 * global theme automatically.
 *
 * Layering (lowest → highest precedence): named `theme` → `accent` brand
 * recolor → explicit `tokens`. Page deltas are also intended to win over
 * cluster deltas for overlapping tokens; ReadingView enforces that by merging
 * the page deltas last on the cluster-scoped header.
 */
import {
  createDarkTheme,
  createLightTheme,
  type Theme as FluentTheme,
} from '@fluentui/react-components';
import { generateBrandVariants } from './brandRamp';
import { isDarkTheme } from '../hooks/useTheme';
import { clusterTokenStyle, type ClusterTokenStyle } from './clusterTokens';
import type { PageTheme } from '../types';

/** Token-name → value delta map (plain Fluent token names, no `--` prefix). */
export type TokenDeltas = Record<string, string>;

/**
 * Brand-family token deltas produced by recoloring `base` with an accent seed.
 * Only tokens whose names mention `Brand`/`OnBrand` are emitted, so the accent
 * recolors brand surfaces while the base theme's neutrals/spacing are kept.
 * Returns an empty map for an unparseable seed (so a bad accent is a no-op).
 */
function brandDeltas(base: FluentTheme, accent: string): TokenDeltas {
  let variants;
  try {
    variants = generateBrandVariants(accent);
  } catch {
    return {};
  }
  const brandTheme = (isDarkTheme(base) ? createDarkTheme : createLightTheme)(variants);
  const out: TokenDeltas = {};
  for (const [k, v] of Object.entries(brandTheme)) {
    if (typeof v === 'string' && /Brand|OnBrand/.test(k)) out[k] = v;
  }
  return out;
}

/** Tokens of `named` that differ from `base` — the deltas to adopt that theme. */
function namedThemeDeltas(base: FluentTheme, named: FluentTheme): TokenDeltas {
  const baseRec = base as unknown as Record<string, unknown>;
  const out: TokenDeltas = {};
  for (const [k, v] of Object.entries(named)) {
    if (typeof v === 'string' && baseRec[k] !== v) out[k] = v;
  }
  return out;
}

/**
 * Resolve a node's per-page theme into Fluent token deltas relative to the
 * active `base` theme. Pure and side-effect free. An absent/empty `page`
 * yields an empty map (no-op). `themeMap` (built-ins + config themes) is used
 * to resolve a named `theme`; an unknown name is ignored.
 */
export function pageThemeTokenDeltas(
  base: FluentTheme,
  page?: PageTheme,
  themeMap?: Record<string, FluentTheme>,
): TokenDeltas {
  if (!page) return {};
  let deltas: TokenDeltas = {};

  // 1. Named theme (lowest page precedence): adopt the tokens that differ from base.
  const named = page.theme ? themeMap?.[page.theme] : undefined;
  if (named) deltas = { ...deltas, ...namedThemeDeltas(base, named) };

  // 2. Accent recolors the brand family on top of the named-or-active base.
  if (page.accent) {
    deltas = { ...deltas, ...brandDeltas(named ?? base, page.accent) };
  }

  // 3. Explicit token deltas always win.
  if (page.tokens) {
    for (const [k, v] of Object.entries(page.tokens)) {
      if (typeof v === 'string') deltas[k] = v;
    }
  }

  return deltas;
}

/**
 * Scoped CSS-variable style object for a page container, computed from a
 * node's per-page theme. Empty (no-op) when the node has no page theme, so
 * unthemed pages leave the global theme untouched.
 */
export function pageThemeStyle(
  base: FluentTheme,
  page?: PageTheme,
  themeMap?: Record<string, FluentTheme>,
): ClusterTokenStyle {
  return clusterTokenStyle(pageThemeTokenDeltas(base, page, themeMap));
}
