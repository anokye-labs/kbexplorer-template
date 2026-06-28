import { describe, it, expect } from 'vitest';
import type { KBGraph, KBNode } from '@anokye-labs/kbexplorer-core';
import {
  renderLlmContext,
  llmContextRepresentation,
  DEFAULT_LLM_CONTEXT_TOKEN_BUDGET,
} from '../llm-context';

function node(id: string, rawContent = `Body of ${id}`): KBNode {
  return {
    id,
    title: `Title ${id}`,
    cluster: 'default',
    content: '',
    rawContent,
    connections: [],
    source: { type: 'file', path: '' },
  };
}

// anchor -> n1 (weight 5), n2 (weight 3); related is weight-ranked.
const graph: KBGraph = {
  nodes: [node('anchor'), node('n1'), node('n2'), node('far')],
  edges: [
    { from: 'anchor', to: 'n1', type: 'references', relation: 'leads', description: '', source: 'inline', weight: 5 },
    { from: 'anchor', to: 'n2', type: 'references', relation: 'staffs', description: '', source: 'inline', weight: 3 },
    { from: 'n1', to: 'far', type: 'references', description: '', source: 'inline', weight: 1 },
  ],
  clusters: [],
  related: { anchor: ['n1', 'n2'], n1: ['anchor', 'far'], n2: ['anchor'] },
};

describe('llm-context representation (F6 #337)', () => {
  it('throws when no anchors are supplied (neighbor-anchored)', () => {
    expect(() => renderLlmContext(graph, {})).toThrowError(/neighbor-anchored/);
    expect(() => renderLlmContext(graph, { anchors: [] })).toThrowError(/anchors/);
  });

  it('throws when an anchor id is absent from the graph', () => {
    expect(() => renderLlmContext(graph, { anchors: ['nope'] })).toThrowError(
      /anchor "nope" not found/,
    );
  });

  it('emits the anchor full content and its weight-ranked neighbors', () => {
    const out = renderLlmContext(graph, { anchors: ['anchor'] });
    expect(out).toContain('## Anchor — Title anchor');
    expect(out).toContain('Body of anchor');
    // n1 (weight 5) appears before n2 (weight 3)
    expect(out.indexOf('Title n1')).toBeLessThan(out.indexOf('Title n2'));
    expect(out).toContain('kg://node/anchor');
  });

  it('never emits the whole graph — only the anchor neighborhood', () => {
    const out = renderLlmContext(graph, { anchors: ['anchor'] });
    // `far` is two hops away and is not a neighbor of the anchor.
    expect(out).not.toContain('Title far');
  });

  it('budget bounds expansion but anchors always remain', () => {
    const out = renderLlmContext(graph, { anchors: ['anchor'], tokenBudget: 0 });
    // anchor still fully present
    expect(out).toContain('## Anchor — Title anchor');
    expect(out).toContain('Body of anchor');
    // no neighbor bodies expanded
    expect(out).not.toContain('Body of n1');
    // unexpanded neighbors surface as navigable kg:// links
    expect(out).toContain('## Navigate');
    expect(out).toContain('[Title n1](kg://node/n1)');
    expect(out).toContain('[Title n2](kg://node/n2)');
  });

  it('expanded neighbors carry their content; links carry kg:// URNs', () => {
    const out = renderLlmContext(graph, { anchors: ['anchor'], tokenBudget: 1000 });
    expect(out).toContain('Body of n1');
    expect(out).toContain('`kg://node/n1`');
    expect(out).toContain('leads');
  });

  it('is deterministic — byte-identical across runs', () => {
    const opts = { anchors: ['anchor'], tokenBudget: 50 };
    expect(renderLlmContext(graph, opts)).toBe(renderLlmContext(graph, opts));
  });

  it('exposes a sane default token budget and registered target', () => {
    expect(DEFAULT_LLM_CONTEXT_TOKEN_BUDGET).toBeGreaterThan(0);
    expect(llmContextRepresentation.target).toBe('llm-context');
    expect(llmContextRepresentation.render(graph, { anchors: ['anchor'] })).toContain(
      '# Knowledge graph context',
    );
  });
});
