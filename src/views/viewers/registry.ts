import type { KBNode } from '../../types';
import { resolveType } from '../../engine/node-types';
import { GenericStructuredView, type ViewerComponent } from './GenericStructuredView';

/**
 * Viewer registry — maps an `entityType` (or JSON-LD `@type`) to a React
 * renderer. This is the open seam that lets a "person" or "team/squad" node get
 * a rich custom view without editing the core. Unknown types resolve to
 * {@link GenericStructuredView}, so coverage is never zero.
 *
 * Keys are matched case-insensitively. Registering the same key twice replaces
 * the prior viewer (last registration wins) so downstream packages can override
 * built-ins.
 */
const registry = new Map<string, ViewerComponent>();

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Register a viewer for an `entityType` / JSON-LD `@type`. */
export function registerViewer(entityType: string, viewer: ViewerComponent): void {
  const key = normalizeKey(entityType ?? '');
  if (!key) return; // reject empty / whitespace-only keys
  registry.set(key, viewer);
}

/** True if a bespoke viewer is registered for the given type. */
export function hasViewer(entityType: string | undefined | null): boolean {
  if (!entityType) return false;
  return registry.has(normalizeKey(entityType));
}

/** List the registered entity-type keys (excluding the generic fallback). */
export function getRegisteredViewers(): string[] {
  return [...registry.keys()];
}

/** Remove all registered viewers — primarily for tests. */
export function resetViewerRegistry(): void {
  registry.clear();
}

/**
 * Resolve a viewer for a node. Resolution precedence:
 * 1. `resolveType(entityType)?.viewer` when the node has an `entityType`.
 * 2. `node.entityType` (or the direct string argument when a string is passed).
 * 3. JSON-LD `@type` — when it is an array each entry is tried in order and the
 *    first entry with a registered viewer wins.
 * 4. {@link GenericStructuredView} fallback.
 */
export function resolveViewer(node: Pick<KBNode, 'entityType' | 'jsonld'> | string | undefined | null): ViewerComponent {
  const candidates: string[] = [];
  if (typeof node === 'string') {
    candidates.push(node);
  } else if (node) {
    const entityType = node.entityType;
    if (entityType) {
      const typeDef = resolveType(entityType);
      if (typeDef?.viewer) candidates.push(typeDef.viewer);
      candidates.push(entityType);
    }
    const ldType = node.jsonld?.['@type'];
    if (Array.isArray(ldType)) candidates.push(...ldType);
    else if (ldType) candidates.push(ldType);
  }

  for (const candidate of candidates) {
    const viewer = registry.get(normalizeKey(candidate));
    if (viewer) return viewer;
  }
  return GenericStructuredView;
}
