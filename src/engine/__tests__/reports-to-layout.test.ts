import { describe, it, expect } from 'vitest';
import type { KBGraph, KBNode, KBEdge } from '../../types';
import { BUILT_IN_VIEWS, getView, filterGraphToView } from '../../representation/views';
import {
  REPORTS_TO_RELATION,
  isPersonNode,
  selectReportsToEdges,
  hasReportsToTree,
  countReportsToParticipants,
  computeReportsToLevels,
  projectReportsToTree,
  DEFAULT_MAX_TREE_NODES,
} from '../reports-to-layout';

// ── Helpers ────────────────────────────────────────────────

function person(id: string, overrides: Partial<KBNode> = {}): KBNode {
  return {
    id,
    title: id,
    cluster: 'org',
    content: '',
    rawContent: '',
    connections: [],
    entityType: 'person',
    source: { type: 'structured', entityType: 'person' },
    ...overrides,
  };
}

/** reports-to edge: report (from) → manager (to). */
function reportsTo(report: string, manager: string): KBEdge {
  return {
    from: report,
    to: manager,
    type: 'related',
    relation: REPORTS_TO_RELATION,
    description: 'Reports to',
    source: 'inferred',
    weight: 1,
  };
}

function graphOf(nodes: KBNode[], edges: KBEdge[]): KBGraph {
  return { nodes, edges, clusters: [{ id: 'org', name: 'Org', color: '#a371f7' }], related: {} };
}

// ── isPersonNode ───────────────────────────────────────────

describe('isPersonNode', () => {
  it('matches entityType person and source.type person', () => {
    expect(isPersonNode(person('a'))).toBe(true);
    expect(isPersonNode({ ...person('b'), entityType: undefined, source: { type: 'person', login: 'b', linked: false } })).toBe(true);
  });
  it('rejects non-person nodes', () => {
    expect(isPersonNode({ ...person('c'), entityType: 'team', source: { type: 'structured', entityType: 'team' } })).toBe(false);
  });
});

// ── selectReportsToEdges / hasReportsToTree / count ─────────

describe('reports-to edge selection', () => {
  it('selects only reports-to edges', () => {
    const g = graphOf(
      [person('a'), person('b')],
      [reportsTo('a', 'b'), { from: 'a', to: 'b', type: 'related', relation: 'staffs', description: '', source: 'inferred', weight: 1 }],
    );
    expect(selectReportsToEdges(g)).toHaveLength(1);
    expect(hasReportsToTree(g)).toBe(true);
    expect(countReportsToParticipants(g)).toBe(2);
  });

  it('ignores reports-to edges to/from non-person nodes', () => {
    const team = { ...person('t'), entityType: 'team', source: { type: 'structured' as const, entityType: 'team' } };
    const g = graphOf([person('a'), team], [reportsTo('a', 't')]);
    expect(hasReportsToTree(g)).toBe(false);
    expect(countReportsToParticipants(g)).toBe(0);
  });

  it('reports no tree on an empty/person-less graph', () => {
    expect(hasReportsToTree(graphOf([], []))).toBe(false);
  });
});

// ── computeReportsToLevels ─────────────────────────────────

describe('computeReportsToLevels', () => {
  it('levels a simple chain (manager above report)', () => {
    // ceo <- vp <- eng   (eng reports to vp reports to ceo)
    const g = graphOf(
      [person('ceo'), person('vp'), person('eng')],
      [reportsTo('vp', 'ceo'), reportsTo('eng', 'vp')],
    );
    const levels = computeReportsToLevels(g);
    expect(levels.get('ceo')).toBe(0);
    expect(levels.get('vp')).toBe(1);
    expect(levels.get('eng')).toBe(2);
  });

  it('places all direct reports at the same level (wide fan-out)', () => {
    const reports = ['r1', 'r2', 'r3', 'r4'];
    const g = graphOf(
      [person('boss'), ...reports.map(r => person(r))],
      reports.map(r => reportsTo(r, 'boss')),
    );
    const levels = computeReportsToLevels(g);
    expect(levels.get('boss')).toBe(0);
    for (const r of reports) expect(levels.get(r)).toBe(1);
  });

  it('supports multiple independent roots', () => {
    const g = graphOf(
      [person('a'), person('a1'), person('b'), person('b1')],
      [reportsTo('a1', 'a'), reportsTo('b1', 'b')],
    );
    const levels = computeReportsToLevels(g);
    expect(levels.get('a')).toBe(0);
    expect(levels.get('b')).toBe(0);
    expect(levels.get('a1')).toBe(1);
    expect(levels.get('b1')).toBe(1);
  });

  it('uses the shortest depth when a person has multiple managers', () => {
    // x reports to both ceo (lvl0) and vp (lvl1) → x should be lvl1 (min)
    const g = graphOf(
      [person('ceo'), person('vp'), person('x')],
      [reportsTo('vp', 'ceo'), reportsTo('x', 'ceo'), reportsTo('x', 'vp')],
    );
    const levels = computeReportsToLevels(g);
    expect(levels.get('x')).toBe(1);
  });

  it('is cycle-safe: every participant gets a finite level', () => {
    // a -> b -> c -> a  (mutual reporting cycle, malformed data)
    const g = graphOf(
      [person('a'), person('b'), person('c')],
      [reportsTo('a', 'b'), reportsTo('b', 'c'), reportsTo('c', 'a')],
    );
    const levels = computeReportsToLevels(g);
    expect(levels.size).toBe(3);
    for (const id of ['a', 'b', 'c']) {
      expect(Number.isFinite(levels.get(id))).toBe(true);
    }
  });

  it('omits people not in any reporting edge', () => {
    const g = graphOf(
      [person('boss'), person('rep'), person('lonely')],
      [reportsTo('rep', 'boss')],
    );
    const levels = computeReportsToLevels(g);
    expect(levels.has('lonely')).toBe(false);
  });

  it('scales to a hundreds-person org with correct levels', () => {
    // branching 4, depth 4 → 1+4+16+64+256 = 341 people. Asserts correctness
    // on a large input (size + depth) deterministically — no wall-clock timing,
    // which is flaky across CI machines.
    const nodes: KBNode[] = [];
    const edges: KBEdge[] = [];
    let counter = 0;
    const root = person(`p${counter++}`);
    nodes.push(root);
    let frontier = [root.id];
    for (let level = 1; level <= 4; level++) {
      const next: string[] = [];
      for (const mgr of frontier) {
        for (let b = 0; b < 4; b++) {
          const id = `p${counter++}`;
          nodes.push(person(id));
          edges.push(reportsTo(id, mgr));
          next.push(id);
        }
      }
      frontier = next;
    }
    expect(nodes.length).toBe(341);
    const levels = computeReportsToLevels(graphOf(nodes, edges));
    expect(levels.size).toBe(341);
    expect(levels.get('p0')).toBe(0);
    expect(Math.max(...levels.values())).toBe(4);
    // Every person is leveled exactly once (single sweep, no orphans left over).
    expect(new Set(levels.keys()).size).toBe(341);
  });
});

// ── projectReportsToTree ───────────────────────────────────

describe('projectReportsToTree', () => {
  it('keeps only tree participants and reports-to edges', () => {
    const team = { ...person('t'), entityType: 'team', source: { type: 'structured' as const, entityType: 'team' } };
    const g = graphOf(
      [person('boss'), person('rep'), person('lonely'), team],
      [
        reportsTo('rep', 'boss'),
        { from: 'rep', to: 't', type: 'related', relation: 'staffs', description: '', source: 'inferred', weight: 1 },
      ],
    );
    const tree = projectReportsToTree(g);
    expect(tree.nodes.map(n => n.id).sort()).toEqual(['boss', 'rep']);
    expect(tree.edges).toHaveLength(1);
    expect(tree.edges[0].relation).toBe(REPORTS_TO_RELATION);
  });

  it('returns an empty graph when there is no reporting tree', () => {
    const tree = projectReportsToTree(graphOf([person('a')], []));
    expect(tree.nodes).toHaveLength(0);
    expect(tree.edges).toHaveLength(0);
  });

  it('rebuilds related restricted to kept nodes', () => {
    const g: KBGraph = {
      ...graphOf([person('boss'), person('rep')], [reportsTo('rep', 'boss')]),
      related: { rep: ['boss', 'ghost'], boss: ['rep'] },
    };
    const tree = projectReportsToTree(g);
    expect(tree.related['rep']).toEqual(['boss']);
    expect(tree.related['boss']).toEqual(['rep']);
  });

  it('truncates to the cap breadth-first while staying rooted', () => {
    // root + 10 reports = 11 nodes; cap at 5 keeps root + first 4 reports
    const reports = Array.from({ length: 10 }, (_, i) => `r${i}`);
    const g = graphOf(
      [person('root'), ...reports.map(r => person(r))],
      reports.map(r => reportsTo(r, 'root')),
    );
    const tree = projectReportsToTree(g, 5);
    expect(tree.nodes.length).toBe(5);
    expect(tree.nodes.some(n => n.id === 'root')).toBe(true);
  });

  it('exposes a sane default cap', () => {
    expect(DEFAULT_MAX_TREE_NODES).toBeGreaterThanOrEqual(100);
  });
});

// ── org built-in view wiring ───────────────────────────────

describe('org built-in view', () => {
  it('registers an org view that requests the reports-to layout', () => {
    const org = getView('org');
    expect(org).toBeDefined();
    expect(org!.layout).toBe('reports-to');
    expect(BUILT_IN_VIEWS.some(v => v.id === 'org')).toBe(true);
  });

  it('resolves to the reporting tree projection', () => {
    const g = graphOf(
      [person('boss'), person('rep')],
      [reportsTo('rep', 'boss')],
    );
    const resolved = filterGraphToView(g, 'org');
    expect(resolved.nodes.map(n => n.id).sort()).toEqual(['boss', 'rep']);
  });

  it('other views keep the default (force) layout', () => {
    expect(getView('all')?.layout).toBeUndefined();
    expect(getView('work')?.layout).toBeUndefined();
  });
});
