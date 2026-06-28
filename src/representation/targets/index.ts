/**
 * Representation targets (Phase 6 / F6 #333) and the default registry.
 *
 * Each target renders the pure `KBGraph` for a {@link RepresentationTarget}:
 * `spa` (the explorer website), `json-ld` (deterministic JSON-LD document) and
 * `llm-context` (neighbor-anchored, token-budgeted Markdown pack). They are
 * interchangeable behind the {@link RepresentationRegistry}.
 */
import { RepresentationRegistry } from '../registry';
import { jsonLdRepresentation } from './json-ld';
import { llmContextRepresentation } from './llm-context';
import { spaRepresentation } from './spa';

export * from './urn';
export * from './json-ld';
export * from './llm-context';
export * from './spa';

/** Build a registry pre-populated with the three built-in targets. */
export function createDefaultRegistry(): RepresentationRegistry {
  return new RepresentationRegistry()
    .register(spaRepresentation)
    .register(jsonLdRepresentation)
    .register(llmContextRepresentation);
}

/** Shared default registry instance (spa + json-ld + llm-context). */
export const representationRegistry = createDefaultRegistry();
