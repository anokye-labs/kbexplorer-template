/**
 * Data helpers for the content-model spine viewers (F2 / T2.5 + T2.6).
 *
 * Kept in a non-component module so the viewer component files stay
 * component-only (react-refresh) while sharing these pure accessors.
 */
import type { KBNode } from '../../types';
// Imported from the schema-reader module directly (not the content-model
// barrel) so this stays free of the register/viewer modules — the barrel would
// create a views ↔ engine import cycle through registerContentModelTypes.
import { urnLocalId } from '../../engine/content-model/schema-reader';

/** Coerce node.data to a record. */
export function dataOf(data: unknown): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>;
}

/** Convenience: read an array field as `unknown[]` (empty when absent). */
export function arrayField(d: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(d[key]) ? (d[key] as unknown[]) : [];
}

/**
/**
 * Resolve a foreign-key field value to a human-readable label.
 *
 * The content-model builder accepts an FK entry as either a bare reference
 * string (`"graph-platform"`) or an inline object carrying the referenced
 * record (`{ id, name }`) — see `refOf` in the builder. This mirrors that
 * contract for display: an object resolves to its `name` (falling back to its
 * `id`), a scalar stringifies, and an entry that carries neither a usable name
 * nor id (the builder diagnoses these as `bad-ref-shape`) resolves to `null`
 * so callers can skip it rather than render `"[object Object]"` or an empty
 * label/link.
 */
export function fkLabel(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'object') {
    const r = v as Record<string, unknown>;
    const label = r.name ?? r.id;
    const s = label != null ? String(label).trim() : '';
    return s || null;
  }
  const s = String(v).trim();
  return s || null;
}

/** Map an array of FK entries to their display labels, dropping unusable ones. */
export function fkLabels(items: unknown[]): string[] {
  return items.map(fkLabel).filter((s): s is string => s != null);
}

/**
 * Read the JSON-LD `@context` prefix → URN-base map from a node's envelope.
 *
 * The content-model builder emits an object-shaped `@context` (CURIE prefix →
 * base, plus `@base`). A string/array context (or none) carries no inline
 * prefixes, so this returns `{}`. Each base value may be a bare string or a
 * `{ "@id": "…" }` object — both shapes are read, mirroring how the schema
 * reader parses the context itself.
 */
export function ldContextOf(node: Pick<KBNode, 'jsonld'>): Record<string, string> {
  const ctx = node.jsonld?.['@context'];
  if (!ctx || typeof ctx !== 'string' && (typeof ctx !== 'object' || Array.isArray(ctx))) {
    return {};
  }
  if (typeof ctx === 'string') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
    else if (v && typeof v === 'object') {
      const iri = (v as Record<string, unknown>)['@id'];
      if (typeof iri === 'string') out[k] = iri;
    }
  }
  return out;
}

/**
 * Resolve a foreign-key reference (e.g. a person `manager` id, or a `team` id)
 * to the graph node id it points at — the same way the content-model builder
 * mints node ids — so a viewer can render it as a navigable `#/node/<id>` link.
 *
 * The reference first expands to the canonical URN (base read from the source
 * node's own JSON-LD `@context`, never hardcoded), then maps to the node's
 * LOCAL graph id via {@link urnLocalId} — since #445 content-model nodes carry
 * a local `id` distinct from their canonical `identity` URN. Pure and SSR-safe.
 * Returns `null` when the reference cannot be resolved (no context base for
 * `kind`, e.g. a work-derived person node) so callers can fall back to plain
 * text rather than emit a broken link.
 *
 * Accepted reference shapes:
 *  - already-expanded URN (`kg://…`)            → its local node id
 *  - CURIE (`person:ada`) whose prefix is known → local id of `<base><local>`
 *  - bare id (`ada`)                            → local id of `<base[kind]><id>`
 */
export function resolveRef(
  node: Pick<KBNode, 'jsonld'>,
  kind: string,
  ref: string,
): string | null {
  const value = ref.trim();
  if (!value) return null;
  if (value.includes('://')) return urnLocalId(value); // already a full URN
  const ctx = ldContextOf(node);
  const colon = value.indexOf(':');
  if (colon > 0) {
    const prefix = value.slice(0, colon);
    const base = ctx[prefix];
    if (typeof base === 'string') return urnLocalId(`${base}${value.slice(colon + 1)}`);
  }
  const base = ctx[kind];
  return typeof base === 'string' ? urnLocalId(`${base}${value}`) : null;
}

/**
 * The repo's native vocabulary term when this node was canonicalized from a
 * cross-repo alias (#153). Surfaced on the JSON-LD envelope as `nativeType` by
 * the content-model builder; `undefined` when the declared `@type` was already
 * canonical, so non-aliased nodes show nothing extra.
 */
export function nativeTypeOf(node: Pick<KBNode, 'jsonld'>): string | undefined {
  const v = node.jsonld?.nativeType;
  return typeof v === 'string' && v ? v : undefined;
}
