/**
 * Data helpers for the content-model spine viewers (F2 / T2.5 + T2.6).
 *
 * Kept in a non-component module so the viewer component files stay
 * component-only (react-refresh) while sharing these pure accessors.
 */

/** Coerce node.data to a record. */
export function dataOf(data: unknown): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>;
}

/** Convenience: read an array field as `unknown[]` (empty when absent). */
export function arrayField(d: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(d[key]) ? (d[key] as unknown[]) : [];
}
