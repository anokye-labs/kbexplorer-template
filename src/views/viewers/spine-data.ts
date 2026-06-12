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
 * The repo's native vocabulary term when this node was canonicalized from a
 * cross-repo alias (#153). Surfaced on the JSON-LD envelope as `nativeType` by
 * the content-model builder; `undefined` when the declared `@type` was already
 * canonical, so non-aliased nodes show nothing extra.
 */
export function nativeTypeOf(node: Pick<KBNode, 'jsonld'>): string | undefined {
  const v = node.jsonld?.nativeType;
  return typeof v === 'string' && v ? v : undefined;
}
