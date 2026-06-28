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

/** Visual style for each edge type */
export interface EdgeTypeStyle {
  color: string;
  dashes: boolean | number[];
  width: number;
  label: string;
}

export const EDGE_TYPE_STYLES: Record<KnownEdgeType, EdgeTypeStyle> = {
  contains:         { color: '#a0adb8', dashes: false,      width: 2,   label: 'Contains' },
  derived_from:     { color: '#e8a854', dashes: false,      width: 2,   label: 'Derived from' },
  imports:          { color: '#a78bfa', dashes: false,      width: 1.5, label: 'Imports' },
  references:       { color: '#79c0ff', dashes: false,      width: 1.5, label: 'References' },
  frontmatter:      { color: '#7ee787', dashes: [6, 4],     width: 1.5, label: 'Frontmatter' },
  cross_references: { color: '#f9a8d4', dashes: false,      width: 1.5, label: 'Cross-ref' },
  modifies:         { color: '#e3b341', dashes: [4, 4],     width: 1.5, label: 'Modifies' },
  closes:           { color: '#56d364', dashes: false,      width: 2,   label: 'Closes' },
  mentions:         { color: '#b1bac4', dashes: [3, 4],     width: 1.2, label: 'Mentions' },
  related:          { color: '#8b949e', dashes: [3, 3],     width: 1.2, label: 'Related' },
};

/** Visual styles for the relation taxonomy (rendered data-drivenly in the legend). */
export const RELATION_STYLES: Record<KnownRelation, EdgeTypeStyle> = {
  leads:            { color: '#f0883e', dashes: false,     width: 2.5, label: 'Leads' },
  staffs:           { color: '#3fb950', dashes: false,     width: 1.5, label: 'Staffs' },
  'reports-to':     { color: '#a371f7', dashes: false,     width: 1.8, label: 'Reports to' },
  structural:       { color: '#a0adb8', dashes: false,     width: 2,   label: 'Structural' },
  derived:          { color: '#e8a854', dashes: [6, 4],    width: 1.5, label: 'Derived' },
  deprecated:       { color: '#8b949e', dashes: [2, 3],    width: 1.2, label: 'Deprecated' },
  // Work-graph organizational-layer relations (#233)
  owns:             { color: '#4A9CC8', dashes: false,     width: 2,   label: 'Owns' },
  'has-priority':   { color: '#E8A838', dashes: [4, 3],    width: 1.8, label: 'Has priority' },
  'tracked-in':     { color: '#a371f7', dashes: [6, 3],    width: 1.5, label: 'Tracked in' },
  // Person-node active-work relations (#235)
  'assigned-to':    { color: '#56d364', dashes: false,     width: 1.8, label: 'Assigned to' },
  'authored':       { color: '#79c0ff', dashes: [4, 3],    width: 1.5, label: 'Authored' },
  'member-of':      { color: '#f0883e', dashes: false,     width: 1.8, label: 'Member of' },
};

const DEFAULT_RELATION_STYLE: EdgeTypeStyle = { color: '#79c0ff', dashes: [2, 2], width: 1.5, label: 'Related' };

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

export const NODE_LAYER_META: Record<NodeLayer, { label: string; color: string }> = {
  file:    { label: 'Files',   color: '#9A8A78' },
  content: { label: 'Content', color: '#58a6ff' },
  work:    { label: 'Work',    color: '#d29922' },
};
