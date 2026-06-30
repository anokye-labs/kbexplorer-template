/**
 * Representation styling — visual treatment for the SPA graph canvas + legend.
 *
 * This module is pure data/representation: edge/relation/node-layer visual
 * styles and the open-safe style resolvers. It imports nothing from the engine,
 * so the pure data contract in `../types` can stay engine-free at load.
 */
import type { EdgeType, KnownEdgeType } from '@anokye-labs/kbexplorer-core';
import type { KnownRelation } from '../types';

/** Default weights per edge type — higher = tighter layout clustering */
export const EDGE_TYPE_WEIGHTS: Record<KnownEdgeType, number> = {
  contains: 5.0,
  derived_from: 3.0,
  imports: 2.0,
  references: 2.0,
  frontmatter: 1.5,
  cross_references: 1.5,
  modifies: 1.0,
  closes: 2.0,
  mentions: 0.5,
  related: 0.3,
};

/**
 * Visual style for each edge type.
 *
 * `color` is the literal hex fallback (theme-independent). `token`, when present,
 * names a Fluent CSS variable (without the leading `--`) that the active theme —
 * including a canvas host's mirrored tokens — resolves to a theme-adaptive color.
 * Renderers go through {@link styleColorVar} (CSS/SVG) or {@link resolveStyleColor}
 * (canvas) so the same style recolors under any theme while still degrading to the
 * hex when the variable is unset. Fluent's `…Foreground2` palette ramp is used
 * because it stays legible on both dark and light neutral backgrounds.
 */
export interface EdgeTypeStyle {
  color: string;
  /** Fluent CSS-var token name (no `--`) resolved against the active theme. */
  token?: string;
  dashes: boolean | number[];
  width: number;
  label: string;
}

export const EDGE_TYPE_STYLES: Record<KnownEdgeType, EdgeTypeStyle> = {
  contains:         { color: '#a0adb8', token: 'colorPalettePlatinumForeground2',  dashes: false,  width: 2,   label: 'Contains' },
  derived_from:     { color: '#e8a854', token: 'colorPaletteDarkOrangeForeground2', dashes: false,  width: 2,   label: 'Derived from' },
  imports:          { color: '#a78bfa', token: 'colorPalettePurpleForeground2',     dashes: false,  width: 1.5, label: 'Imports' },
  references:       { color: '#79c0ff', token: 'colorPaletteBlueForeground2',       dashes: false,  width: 1.5, label: 'References' },
  frontmatter:      { color: '#7ee787', token: 'colorPaletteLightGreenForeground2', dashes: [6, 4], width: 1.5, label: 'Frontmatter' },
  cross_references: { color: '#f9a8d4', token: 'colorPalettePinkForeground2',       dashes: false,  width: 1.5, label: 'Cross-ref' },
  modifies:         { color: '#e3b341', token: 'colorPaletteMarigoldForeground2',   dashes: [4, 4], width: 1.5, label: 'Modifies' },
  closes:           { color: '#56d364', token: 'colorPaletteGreenForeground2',      dashes: false,  width: 2,   label: 'Closes' },
  mentions:         { color: '#b1bac4', token: 'colorPaletteBeigeForeground2',       dashes: [3, 4], width: 1.2, label: 'Mentions' },
  related:          { color: '#8b949e', token: 'colorNeutralForeground3',            dashes: [3, 3], width: 1.2, label: 'Related' },
};

/** Visual styles for the relation taxonomy (rendered data-drivenly in the legend). */
export const RELATION_STYLES: Record<KnownRelation, EdgeTypeStyle> = {
  leads:            { color: '#f0883e', token: 'colorPaletteDarkOrangeForeground2', dashes: false,  width: 2.5, label: 'Leads' },
  staffs:           { color: '#3fb950', token: 'colorPaletteGreenForeground2',      dashes: false,  width: 1.5, label: 'Staffs' },
  'reports-to':     { color: '#a371f7', token: 'colorPalettePurpleForeground2',     dashes: false,  width: 1.8, label: 'Reports to' },
  structural:       { color: '#a0adb8', token: 'colorPalettePlatinumForeground2',   dashes: false,  width: 2,   label: 'Structural' },
  derived:          { color: '#e8a854', token: 'colorPaletteDarkOrangeForeground2', dashes: [6, 4], width: 1.5, label: 'Derived' },
  deprecated:       { color: '#8b949e', token: 'colorNeutralForeground3',           dashes: [2, 3], width: 1.2, label: 'Deprecated' },
  // Work-graph organizational-layer relations (#233)
  owns:             { color: '#4A9CC8', token: 'colorPaletteSteelForeground2',      dashes: false,  width: 2,   label: 'Owns' },
  'has-priority':   { color: '#E8A838', token: 'colorPaletteMarigoldForeground2',   dashes: [4, 3], width: 1.8, label: 'Has priority' },
  'tracked-in':     { color: '#a371f7', token: 'colorPalettePurpleForeground2',     dashes: [6, 3], width: 1.5, label: 'Tracked in' },
  // Person-node active-work relations (#235)
  'assigned-to':    { color: '#56d364', token: 'colorPaletteGreenForeground2',      dashes: false,  width: 1.8, label: 'Assigned to' },
  'authored':       { color: '#79c0ff', token: 'colorPaletteBlueForeground2',       dashes: [4, 3], width: 1.5, label: 'Authored' },
  'member-of':      { color: '#f0883e', token: 'colorPaletteDarkOrangeForeground2', dashes: false,  width: 1.8, label: 'Member of' },
};

const DEFAULT_RELATION_STYLE: EdgeTypeStyle = { color: '#79c0ff', token: 'colorPaletteBlueForeground2', dashes: [2, 2], width: 1.5, label: 'Related' };

/** Title-case an arbitrary relation/edge key for display in the legend. */
function humanizeKey(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve the visual style for an edge, data-drivenly.
 *
 * Precedence: explicit `relation` (taxonomy → known style; otherwise a default
 * style with a humanized label) → known `type` style → for an unknown (open)
 * `type`, the neutral `related` visual style but with the actual type string
 * humanized as the label so new edge kinds still render distinctly in the
 * legend. This is the single source of truth used by both the graph renderer
 * and the legend so new relations show up without code edits.
 */
export function getEdgeStyle(edge: { type?: EdgeType; relation?: string }): EdgeTypeStyle {
  if (edge.relation) {
    const known = RELATION_STYLES[edge.relation as KnownRelation];
    if (known) return known;
    return { ...DEFAULT_RELATION_STYLE, label: humanizeKey(edge.relation) };
  }
  const t = (edge.type ?? 'related') as KnownEdgeType;
  const known = EDGE_TYPE_STYLES[t];
  if (known) return known;
  // Open/unknown edge type: keep the neutral `related` visual treatment but
  // preserve the actual type string as a humanized label so F2/F3 relations are
  // distinguishable in the data-driven legend.
  return { ...EDGE_TYPE_STYLES.related, label: humanizeKey(edge.type as string) };
}

/** The legend key for an edge — its relation when present, else its type. */
export function getEdgeLegendKey(edge: { type?: EdgeType; relation?: string }): string {
  return edge.relation ?? (edge.type as string) ?? 'related';
}

/** Resolve the layout weight for an edge type (open-safe). */
export function getEdgeWeight(type: EdgeType | undefined): number {
  return EDGE_TYPE_WEIGHTS[(type ?? 'related') as KnownEdgeType] ?? 1;
}

/** The graph layer a node is classified into for layer-based views/legends. */
export type NodeLayer = 'file' | 'content' | 'work';

export const NODE_LAYER_META: Record<NodeLayer, { label: string; color: string; token: string }> = {
  file:    { label: 'Files',   color: '#9A8A78', token: 'colorPaletteBrownForeground2' },
  content: { label: 'Content', color: '#58a6ff', token: 'colorPaletteBlueForeground2' },
  work:    { label: 'Work',    color: '#d29922', token: 'colorPaletteMarigoldForeground2' },
};

/**
 * A theme-aware color carrier: a literal `color` hex (fallback) plus an optional
 * Fluent CSS-var `token`. Both {@link EdgeTypeStyle} and {@link NODE_LAYER_META}
 * entries satisfy this, so the resolvers below work for edges, relations, and
 * node layers alike.
 */
export interface TokenizedColor {
  color: string;
  token?: string;
}

/**
 * CSS color expression for SVG/HTML contexts (legend swatches, inline styles).
 * Prefers the theme token and degrades to the literal hex when the variable is
 * unset, so a non-default or host theme recolors the legend with no code change.
 */
export function styleColorVar(style: TokenizedColor): string {
  return style.token ? `var(--${style.token}, ${style.color})` : style.color;
}

/**
 * Resolve a concrete color string for canvas rendering, which cannot use
 * `var()`. Reads the style's Fluent CSS variable from `root` (defaulting to
 * `document.documentElement`) and returns the literal hex fallback when the
 * variable is unset, when there is no `token`, or when the DOM is unavailable
 * (SSR/tests). `root` should be an element inside the active `FluentProvider`
 * subtree so it inherits that theme's token variables.
 */
export function resolveStyleColor(style: TokenizedColor, root?: Element | null): string {
  if (!style.token) return style.color;
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el || typeof getComputedStyle === 'undefined') return style.color;
  try {
    const v = getComputedStyle(el).getPropertyValue(`--${style.token}`).trim();
    return v || style.color;
  } catch {
    return style.color;
  }
}

/**
 * Apply an alpha to a resolved color robustly, regardless of its format.
 *
 * Edge colors now resolve from theme CSS variables, so a value may be a hex
 * (`#rrggbb`) OR an `rgb()/rgba()` string (e.g. when a host theme overrides a
 * token with an `rgb()` value). The old `color + '80'` hex-suffix trick produced
 * invalid strings like `rgb(…)80` for the non-hex case; this parses both forms
 * and emits a valid `rgba(...)`, falling back to the original color when it can't
 * be parsed.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
  }
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  return color;
}

/** Per-tier visual treatment for an edge during focus/neighborhood emphasis. */
export interface EmphasisEdgeStyle {
  color: string;
  width: number;
  dashes: boolean | number[];
}

/**
 * Resolve an edge's emphasis treatment by hop distance from the focused node.
 * `styleColor` is the already-resolved base color (hex OR `rgb()` from a theme
 * var). Translucency is applied via {@link withAlpha} so the output is ALWAYS a
 * valid CSS color — never a bare hex-suffix appended to an `rgb()` string, the
 * bug that broke focus rendering once colors could resolve from CSS variables.
 *
 *  - Tier 0 (`maxHop ≤ 1`): direct neighborhood — full color, wider.
 *  - Tier 1 (`minHop ≤ 1`): one endpoint adjacent — 50% alpha.
 *  - Tier 2 (`maxHop ≤ 2`): 2-hop bridge — 25% alpha, thinner.
 *  - Tier 3 (distant): theme-neutral barely-visible wash.
 */
export function emphasisEdgeStyle(
  styleColor: string,
  baseWidth: number,
  baseDashes: boolean | number[],
  maxHop: number,
  minHop: number,
  isDark: boolean,
): EmphasisEdgeStyle {
  if (maxHop <= 1) {
    return { color: styleColor, width: baseWidth * 1.2, dashes: baseDashes };
  }
  if (minHop <= 1) {
    return { color: withAlpha(styleColor, 0.5), width: baseWidth * 0.8, dashes: baseDashes };
  }
  if (maxHop <= 2) {
    return { color: withAlpha(styleColor, 0.25), width: Math.max(baseWidth * 0.5, 0.8), dashes: baseDashes };
  }
  return { color: isDark ? 'rgba(60,60,60,0.15)' : 'rgba(180,180,180,0.15)', width: 0.4, dashes: false };
}
