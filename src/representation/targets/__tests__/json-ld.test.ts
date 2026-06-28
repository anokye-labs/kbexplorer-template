import { describe, it, expect } from 'vitest';
import type { KBGraph, KBNode } from '@anokye-labs/kbexplorer-core';
import {
  buildGraphJsonLd,
  serializeGraphJsonLd,
  jsonLdRepresentation,
} from '../json-ld';

function node(overrides: Partial<KBNode> & Pick<KBNode, 'id'>): KBNode {
  return {
    title: overrides.id,
    cluster: 'default',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'file', path: '' },
    ...overrides,
  };
}

const graph: KBGraph = {
  nodes: [
    node({ id: 'b', title: 'Bee', entityType: 'person', identity: 'kg://person/b' }),
    node({ id: 'a', title: 'Ay' }),
  ],
  edges: [
    { from: 'a', to: 'b', type: 'references', description: '', source: 'inline', weight: 1 },
  ],
  clusters: [],
  related: {},
};

describe('json-ld representation (F6 #336)', () => {
  it('emits a schema.org @graph with one envelope per node, sorted by id', () => {
    const doc = buildGraphJsonLd(graph);
    expect(doc['@context']).toBe('https://schema.org');
    expect(doc['@graph'].map(n => n['@id'])).toEqual([
      'kg://node/a',
      'kg://person/b',
    ]);
  });

  it('reuses node identity as @id and entityType/LD type as @type', () => {
    const doc = buildGraphJsonLd(graph);
    const bee = doc['@graph'].find(n => n['@id'] === 'kg://person/b')!;
    expect(bee['@type']).toBe('person');
    expect(bee.name).toBe('Bee');
  });

  it('expresses edges as isRelatedTo links between node URNs', () => {
    const doc = buildGraphJsonLd(graph);
    const ay = doc['@graph'].find(n => n['@id'] === 'kg://node/a')!;
    expect(ay.isRelatedTo).toEqual([{ '@id': 'kg://person/b' }]);
  });

  it('is deterministic — byte-identical across runs', () => {
    expect(serializeGraphJsonLd(graph)).toBe(serializeGraphJsonLd(graph));
  });

  it('renders via the registered representation target', () => {
    expect(jsonLdRepresentation.target).toBe('json-ld');
    expect(jsonLdRepresentation.render(graph)).toBe(serializeGraphJsonLd(graph));
  });
});
