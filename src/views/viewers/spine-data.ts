/**
 * Data helpers for the content-model spine viewers (F2 / T2.5 + T2.6).
 *
 * Kept in a non-component module so the viewer component files stay
 * component-only (react-refresh) while sharing these pure accessors.
 */
import type { KBNode } from '../../types';

/** Coerce node.data to a record. */
export function dataOf(data: unknown): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>;
}

/** Convenience: read an array field as `unknown[]` (empty when absent). */
export function arrayField(d: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(d[key]) ? (d[key] as unknown[]) : [];
}

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
 * The repo's native vocabulary term when this node was canonicalized from a
 * cross-repo alias (#153). Surfaced on the JSON-LD envelope as `nativeType` by
 * the content-model builder; `undefined` when the declared `@type` was already
 * canonical, so non-aliased nodes show nothing extra.
 */
export function nativeTypeOf(node: Pick<KBNode, 'jsonld'>): string | undefined {
  const v = node.jsonld?.nativeType;
  return typeof v === 'string' && v ? v : undefined;
}
