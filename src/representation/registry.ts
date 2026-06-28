/**
 * Representation registry (Phase 6 / F6 #334).
 *
 * A {@link Representation} is a rendering target that takes the **pure**
 * `KBGraph` (+ options) and produces an output artifact — the SPA website, a
 * JSON-LD document, a token-budgeted LLM-context pack. They are interchangeable:
 * callers select one by name. This registry maps a target name to its
 * implementation (register / resolve), parallel to the engine's provider
 * registry.
 *
 * Representations consume only the pure graph; they never reach back into the
 * engine/loader to refetch a system of record. The pure-string targets enforce
 * that statically (see `targets/__tests__/no-engine-import.test.ts`).
 */
import type {
  Representation,
  RepresentationTarget,
} from '@anokye-labs/kbexplorer-core';

/** Maps a {@link RepresentationTarget} name to its {@link Representation}. */
export class RepresentationRegistry {
  private readonly byTarget = new Map<string, Representation<unknown>>();

  /** Register (or replace) the representation for its target. Chainable. */
  register<Out>(representation: Representation<Out>): this {
    this.byTarget.set(
      representation.target,
      representation as Representation<unknown>,
    );
    return this;
  }

  /** Resolve a representation by target name; throws if none is registered. */
  resolve<Out = string>(target: RepresentationTarget): Representation<Out> {
    const representation = this.byTarget.get(target);
    if (!representation) {
      throw new Error(
        `No representation registered for target "${target}". ` +
          `Known targets: ${this.list().join(', ') || '(none)'}.`,
      );
    }
    return representation as Representation<Out>;
  }

  /** Whether a representation is registered for `target`. */
  has(target: RepresentationTarget): boolean {
    return this.byTarget.has(target);
  }

  /** Registered target names, sorted for deterministic enumeration. */
  list(): string[] {
    return [...this.byTarget.keys()].sort();
  }
}
