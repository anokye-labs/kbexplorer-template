/**
 * Shared `kg://` URN derivation for representation targets.
 *
 * Every target that emits stable identifiers (json-ld `@id`, llm-context
 * navigable links) must agree on a node's URN so the same real-world entity
 * lines up across representations. This mirrors the rule baked into core's
 * {@link buildJsonLd} (`@id` reuses the node's `identity`, falling back to
 * `kg://node/<id>`) so json-ld and llm-context are guaranteed consistent.
 */
import type { KBNode } from '../../types';

/** Canonical `kg://` URN for a node — reuses `identity`, never path-derived. */
export function nodeUrn(node: Pick<KBNode, 'id' | 'identity'>): string {
  return node.identity ?? `kg://node/${node.id}`;
}
