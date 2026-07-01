/**
 * Representation targets (Phase 6 / F6 #333) and the default registry.
 *
 * Each target renders the pure `KBGraph` for a {@link RepresentationTarget}:
 * `spa` (the explorer website), `json-ld` (deterministic JSON-LD document),
 * `llm-context` (neighbor-anchored, token-budgeted Markdown pack) and `copilot`
 * (the embeddable canvas surface, #440 — initially reusing the spa viewers).
 * They are interchangeable behind the {@link RepresentationRegistry}.
 */
import { RepresentationRegistry } from '../registry';
import { jsonLdRepresentation } from './json-ld';
import { llmContextRepresentation } from './llm-context';
import { spaRepresentation } from './spa';
import { copilotRepresentation } from './copilot';

export * from './urn';
export * from './json-ld';
export * from './llm-context';
export * from './spa';
export * from './copilot';

/** Build a registry pre-populated with the built-in targets. */
export function createDefaultRegistry(): RepresentationRegistry {
  return new RepresentationRegistry()
    .register(spaRepresentation)
    .register(jsonLdRepresentation)
    .register(llmContextRepresentation)
    .register(copilotRepresentation);
}

/** Shared default registry instance (spa + json-ld + llm-context + copilot). */
export const representationRegistry = createDefaultRegistry();
