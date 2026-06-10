/**
 * Demo-entities seam (off by default).
 *
 * Injects a small set of `person` / `team` entity nodes — wired with the
 * relation taxonomy (leads | staffs | reports-to) — so the open node-type
 * foundation can be exercised end-to-end (entity viewer, SourceBadge, relation
 * legend) without polluting real knowledge graphs.
 *
 * Enabled by `?demo=entities` in the URL or `localStorage['kbe-demo-entities']`
 * set to `'1'` / `'true'`. When disabled the graph is returned unchanged.
 */
import type { KBGraph, KBNode, KBEdge, Cluster } from '../types';
import { buildJsonLd } from '../types';
import { registerType } from './node-types';
import { registerViewer } from '../views/viewers';
import { PersonView } from '../views/viewers/PersonView';

const DEMO_CLUSTER: Cluster = { id: 'org', name: 'Organization', color: '#c0a3ff' };

/** Whether the demo-entities seam is enabled for this session. */
export function isDemoEntitiesEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'entities') return true;
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex >= 0) {
        const hp = new URLSearchParams(hash.slice(qIndex + 1));
        if (hp.get('demo') === 'entities') return true;
      }
      const flag = window.localStorage?.getItem('kbe-demo-entities');
      if (flag === '1' || flag === 'true') return true;
    }
  } catch {
    /* access to window/localStorage may be denied; treat as disabled */
  }
  return false;
}

/** Register the `person` / `team` node types + the bespoke person viewer. Idempotent. */
export function registerDemoEntityTypes(): void {
  registerType({
    id: 'person',
    label: 'Person',
    layer: 'work',
    cluster: DEMO_CLUSTER.id,
    relations: ['reports-to', 'leads'],
    viewer: 'person',
    description: 'An individual contributor or manager.',
  });
  registerType({
    id: 'team',
    label: 'Team',
    layer: 'work',
    cluster: DEMO_CLUSTER.id,
    relations: ['staffs', 'leads'],
    description: 'A squad / team that staffs people and is led by a person.',
  });
  registerViewer('person', PersonView);
}

function entityNode(
  id: string,
  title: string,
  entityType: string,
  data: Record<string, unknown>,
  ldType: string,
): KBNode {
  const identity = `kg://${entityType}/${id}`;
  return {
    id,
    title,
    cluster: DEMO_CLUSTER.id,
    content: '',
    rawContent: '',
    display: 'entity',
    connections: [],
    identity,
    source: { type: 'structured', entityType },
    entityType,
    provider: 'demo-entities',
    data,
    jsonld: buildJsonLd({ id, identity }, ldType, data),
  };
}

function relationEdge(from: string, to: string, relation: string, description: string): KBEdge {
  return { from, to, type: 'related', relation, description, source: 'inferred', weight: 1 };
}

/**
 * Return a new graph with demo entity nodes + relation edges appended. The
 * original graph is not mutated. A `team` node is linked to an existing hub node
 * (readme/home/first) so the demo subgraph is reachable.
 */
export function injectDemoEntities(graph: KBGraph): KBGraph {
  registerDemoEntityTypes();

  const team = entityNode(
    'demo-team-atlas',
    'Team Atlas',
    'team',
    { name: 'Team Atlas', mission: 'Owns the knowledge-graph engine', size: 4 },
    'Organization',
  );
  const lead = entityNode(
    'demo-person-ada',
    'Ada Okonkwo',
    'person',
    { name: 'Ada Okonkwo', role: 'Engineering Lead', email: 'ada@example.com', team: 'Team Atlas' },
    'Person',
  );
  const ic = entityNode(
    'demo-person-ben',
    'Ben Carter',
    'person',
    { name: 'Ben Carter', role: 'Software Engineer', email: 'ben@example.com', team: 'Team Atlas' },
    'Person',
  );

  const newNodes: KBNode[] = [team, lead, ic];

  const newEdges: KBEdge[] = [
    relationEdge(lead.id, team.id, 'leads', 'Ada leads Team Atlas'),
    relationEdge(team.id, lead.id, 'staffs', 'Team Atlas staffs Ada'),
    relationEdge(team.id, ic.id, 'staffs', 'Team Atlas staffs Ben'),
    relationEdge(ic.id, lead.id, 'reports-to', 'Ben reports to Ada'),
  ];

  // Anchor the demo subgraph to an existing hub so it is reachable in the graph.
  const hub =
    graph.nodes.find(n => n.id === 'readme') ??
    graph.nodes.find(n => n.id === 'home') ??
    graph.nodes.find(n => n.id === 'overview') ??
    graph.nodes[0];
  if (hub) {
    newEdges.push(relationEdge(hub.id, team.id, 'structural', `${hub.title} → Team Atlas`));
  }

  const clusters = graph.clusters.some(c => c.id === DEMO_CLUSTER.id)
    ? graph.clusters
    : [...graph.clusters, DEMO_CLUSTER];

  return {
    nodes: [...graph.nodes, ...newNodes],
    edges: [...graph.edges, ...newEdges],
    clusters,
    related: graph.related,
  };
}
