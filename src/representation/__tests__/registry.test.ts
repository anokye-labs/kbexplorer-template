import { describe, it, expect } from 'vitest';
import type { Representation, KBGraph } from '@anokye-labs/kbexplorer-core';
import { RepresentationRegistry } from '../registry';
import {
  createDefaultRegistry,
  representationRegistry,
  jsonLdRepresentation,
  llmContextRepresentation,
  spaRepresentation,
  copilotRepresentation,
} from '../targets';

const EMPTY_GRAPH: KBGraph = { nodes: [], edges: [], clusters: [], related: {} };

describe('RepresentationRegistry (F6 #334)', () => {
  it('registers and resolves a representation by target name', () => {
    const rep: Representation<string> = { target: 'json-ld', render: () => 'x' };
    const registry = new RepresentationRegistry().register(rep);
    expect(registry.resolve('json-ld')).toBe(rep);
    expect(registry.has('json-ld')).toBe(true);
  });

  it('throws a helpful error for an unregistered target', () => {
    const registry = new RepresentationRegistry();
    expect(() => registry.resolve('llm-context')).toThrowError(
      /No representation registered for target "llm-context"/,
    );
  });

  it('lists registered targets in sorted order', () => {
    const registry = new RepresentationRegistry()
      .register({ target: 'spa', render: () => null })
      .register({ target: 'json-ld', render: () => '' });
    expect(registry.list()).toEqual(['json-ld', 'spa']);
  });

  it('replaces a representation registered for the same target', () => {
    const first: Representation<string> = { target: 'json-ld', render: () => 'a' };
    const second: Representation<string> = { target: 'json-ld', render: () => 'b' };
    const registry = new RepresentationRegistry().register(first).register(second);
    expect(registry.resolve('json-ld')).toBe(second);
  });
});

describe('default registry resolves all built-in targets (F6 #333, B1 #440)', () => {
  it('resolves spa, json-ld, llm-context and copilot', () => {
    const registry = createDefaultRegistry();
    expect(registry.list()).toEqual(['copilot', 'json-ld', 'llm-context', 'spa']);
    expect(registry.resolve('spa')).toBe(spaRepresentation);
    expect(registry.resolve('json-ld')).toBe(jsonLdRepresentation);
    expect(registry.resolve('llm-context')).toBe(llmContextRepresentation);
    expect(registry.resolve('copilot')).toBe(copilotRepresentation);
  });

  it('exposes a shared default registry instance', () => {
    expect(representationRegistry.list()).toEqual([
      'copilot',
      'json-ld',
      'llm-context',
      'spa',
    ]);
  });

  it('json-ld renders an empty graph deterministically', () => {
    const out = representationRegistry.resolve('json-ld').render(EMPTY_GRAPH);
    expect(out).toBe(
      '{\n  "@context": "https://schema.org",\n  "@graph": []\n}\n',
    );
  });
});
