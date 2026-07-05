/**
 * Demo-entities seam (off by default).
 *
 * Injects a small set of `person` / `squad` / `team` entity nodes — wired with
 * the relation taxonomy (leads | staffs | reports-to) — so the open node-type
 * foundation can be exercised end-to-end (entity viewers, SourceBadge, relation
 * legend) without polluting real knowledge graphs.
 *
 * Enabled by `?demo=entities` in the URL or `localStorage['kbe-demo-entities']`
 * set to `'1'` / `'true'`. When disabled the graph is returned unchanged.
 */
import type { KBGraph, KBNode, KBEdge, Cluster } from '../types';
import { buildJsonLd } from '../types';
import { registerType } from '@anokye-labs/kbexplorer-engine';
import { buildSampleRichMarkdownNode } from './demo-rich-markdown';

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

/** Register the `person` / `squad` / `team` node types + bespoke viewers. Idempotent. */
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
    id: 'squad',
    label: 'Squad',
    layer: 'work',
    cluster: DEMO_CLUSTER.id,
    relations: ['staffs', 'leads'],
    viewer: 'squad',
    description: 'A squad that staffs people, is led by a DRI and delivers a workstream.',
  });
  registerType({
    id: 'team',
    label: 'Team',
    layer: 'work',
    cluster: DEMO_CLUSTER.id,
    relations: ['staffs', 'leads'],
    description: 'A squad / team that staffs people and is led by a person.',
  });
  // `charter` deliberately has NO bespoke viewer — it exists to exercise the
  // generic structured-viewer fallback end-to-end (team gained TeamView in #233).
  registerType({
    id: 'charter',
    label: 'Charter',
    layer: 'work',
    cluster: DEMO_CLUSTER.id,
    relations: [],
    description: 'A team charter document (demo kind with no bespoke viewer).',
  });
}

/**
 * Whether the large synthetic-org demo seam is enabled for this session.
 *
 * Query-param only (`?demo=bigorg`) — deliberately NOT backed by localStorage.
 * The persisted `kbe-*` keys are part of this repo's settings contract; this is
 * a throwaway scale-testing seam, so it stays ephemeral and leaves no trace.
 */
export function isBigOrgDemoEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'bigorg') return true;
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex >= 0) {
        const hp = new URLSearchParams(hash.slice(qIndex + 1));
        if (hp.get('demo') === 'bigorg') return true;
      }
    }
  } catch {
    /* access to window may be denied; treat as disabled */
  }
  return false;
}

/**
 * Build a deep/wide synthetic org of `person` nodes wired by `reports-to`
 * (report → manager) edges — a single rooted tree. Used to validate the
 * hierarchical org-tree layout (#279) at a hundreds-person scale without
 * committing hundreds of YAML files.
 */
export function generateOrgTree(
  branching = 4,
  depth = 4,
): { nodes: KBNode[]; edges: KBEdge[] } {
  const nodes: KBNode[] = [];
  const edges: KBEdge[] = [];
  let counter = 0;

  const makePerson = (level: number): KBNode => {
    const idx = counter++;
    const id = `org-p${idx}`;
    const role = level === 0 ? 'Chief Executive' : level === 1 ? 'VP' : level === 2 ? 'Director' : 'Engineer';
    return entityNode(
      id,
      `${role} ${idx}`,
      'person',
      { name: `${role} ${idx}`, role, email: `p${idx}@example.com`, level },
      'Person',
    );
  };

  const root = makePerson(0);
  nodes.push(root);

  let frontier = [root];
  for (let level = 1; level <= depth; level++) {
    const next: KBNode[] = [];
    for (const manager of frontier) {
      for (let b = 0; b < branching; b++) {
        const report = makePerson(level);
        nodes.push(report);
        next.push(report);
        // reports-to edge: report (from) → manager (to)
        edges.push(relationEdge(report.id, manager.id, 'reports-to', `${report.title} reports to ${manager.title}`));
      }
    }
    frontier = next;
  }

  return { nodes, edges };
}

/**
 * Return a new graph with a large synthetic org tree appended (off by default).
 * Idempotent: skips injection if the org tree is already present.
 */
export function injectBigOrg(graph: KBGraph): KBGraph {
  registerDemoEntityTypes();

  if (graph.nodes.some(n => n.id === 'org-p0')) return graph;

  const { nodes: orgNodes, edges: orgEdges } = generateOrgTree();

  // Anchor the root to an existing hub so the subgraph is reachable in non-org
  // views (the org view itself only needs the reports-to edges).
  const hub =
    graph.nodes.find(n => n.id === 'readme') ??
    graph.nodes.find(n => n.id === 'home') ??
    graph.nodes.find(n => n.id === 'overview') ??
    graph.nodes[0];
  if (hub) {
    orgEdges.push(relationEdge(hub.id, 'org-p0', 'structural', `${hub.title} → Org`));
  }

  const clusters = graph.clusters.some(c => c.id === DEMO_CLUSTER.id)
    ? graph.clusters
    : [...graph.clusters, DEMO_CLUSTER];

  return {
    nodes: [...graph.nodes, ...orgNodes],
    edges: [...graph.edges, ...orgEdges],
    clusters,
    related: graph.related,
  };
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

/** Cluster the rich-Markdown demo doc lands in. */
const DOCS_DEMO_CLUSTER: Cluster = { id: 'docs', name: 'Documentation', color: '#D4A050' };

/**
 * Whether the rich-Markdown demo seam is enabled for this session.
 *
 * Query-param only (`?demo=richmd`, including the hash query) — deliberately NOT
 * backed by localStorage, so it leaves no trace in the persisted `kbe-*`
 * settings contract (and needs no CACHE_VERSION bump).
 */
export function isRichMarkdownDemoEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'richmd') return true;
      const hash = window.location.hash;
      const qIndex = hash.indexOf('?');
      if (qIndex >= 0) {
        const hp = new URLSearchParams(hash.slice(qIndex + 1));
        if (hp.get('demo') === 'richmd') return true;
      }
    }
  } catch {
    /* access to window may be denied; treat as disabled */
  }
  return false;
}

/**
 * Return a new graph with the sample rich-Markdown document appended (off by
 * default). Idempotent: skips injection if the demo doc is already present. The
 * doc is anchored to an existing hub so it is reachable in the graph.
 */
export function injectRichMarkdownDemo(graph: KBGraph): KBGraph {
  const DEMO_ID = 'demo-richmd-doc';
  if (graph.nodes.some(n => n.id === DEMO_ID)) return graph;

  const node = buildSampleRichMarkdownNode(DEMO_ID);

  const hub =
    graph.nodes.find(n => n.id === 'readme') ??
    graph.nodes.find(n => n.id === 'home') ??
    graph.nodes.find(n => n.id === 'overview') ??
    graph.nodes[0];

  const newEdges: KBEdge[] = [];
  if (hub) {
    newEdges.push(relationEdge(hub.id, DEMO_ID, 'structural', `${hub.title} → ${node.title}`));
  }

  const clusters = graph.clusters.some(c => c.id === DOCS_DEMO_CLUSTER.id)
    ? graph.clusters
    : [...graph.clusters, DOCS_DEMO_CLUSTER];

  return {
    nodes: [...graph.nodes, node],
    edges: [...graph.edges, ...newEdges],
    clusters,
    related: graph.related,
  };
}

/**
 * Return a new graph with demo entity nodes + relation edges appended. The
 * original graph is not mutated. A `team` node is linked to an existing hub node
 * (readme/home/first) so the demo subgraph is reachable.
 */
export function injectDemoEntities(graph: KBGraph): KBGraph {
  registerDemoEntityTypes();

  const DEMO_IDS = ['demo-team-atlas', 'demo-squad-orbit', 'demo-person-ada', 'demo-person-ben', 'demo-charter-atlas'];
  // Guard against collisions / double-injection: if any fixed demo id already
  // exists in the graph, skip injection and return it unchanged.
  if (graph.nodes.some(n => DEMO_IDS.includes(n.id))) {
    return graph;
  }

  const team = entityNode(
    'demo-team-atlas',
    'Team Atlas',
    'team',
    {
      name: 'Team Atlas',
      mission: 'Owns the knowledge-graph engine',
      size: 4,
      lead: 'Ada Okonkwo',
      members: ['Ada Okonkwo', 'Ben Carter'],
      workstreams: ['Discovery'],
    },
    'Organization',
  );
  const squad = entityNode(
    'demo-squad-orbit',
    'Squad Orbit',
    'squad',
    {
      name: 'Squad Orbit',
      mission: 'Delivers the discovery & search experience',
      dri: 'ada',
      workstream: 'Discovery',
      members: ['Ada Okonkwo', 'Ben Carter'],
      knowledgeAreas: ['search', 'ranking', 'graph-ui'],
    },
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

  const charter = entityNode(
    'demo-charter-atlas',
    'Atlas Charter',
    'charter',
    { name: 'Atlas Charter', mission: 'Owns the knowledge-graph engine', reviewed: '2026-01-15' },
    'CreativeWork',
  );

  const newNodes: KBNode[] = [team, squad, lead, ic, charter];

  const newEdges: KBEdge[] = [
    relationEdge(lead.id, team.id, 'leads', 'Ada leads Team Atlas'),
    relationEdge(team.id, lead.id, 'staffs', 'Team Atlas staffs Ada'),
    relationEdge(team.id, ic.id, 'staffs', 'Team Atlas staffs Ben'),
    relationEdge(ic.id, lead.id, 'reports-to', 'Ben reports to Ada'),
    relationEdge(squad.id, lead.id, 'staffs', 'Squad Orbit staffs Ada'),
    relationEdge(squad.id, ic.id, 'staffs', 'Squad Orbit staffs Ben'),
    relationEdge(lead.id, squad.id, 'leads', 'Ada (DRI) leads Squad Orbit'),
    relationEdge(team.id, squad.id, 'structural', 'Team Atlas → Squad Orbit'),
    relationEdge(team.id, charter.id, 'structural', 'Team Atlas → Atlas Charter'),
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
