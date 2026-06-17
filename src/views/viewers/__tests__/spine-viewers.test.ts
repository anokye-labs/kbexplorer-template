import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KBNode } from '../../../types';
import { resolveViewer, resetViewerRegistry, type ViewerComponent } from '../index';
import { resetNodeTypeRegistry } from '../../../engine/node-types';
import { registerContentModelTypes, CONTENT_MODEL_KINDS } from '../../../engine/content-model';
import { SquadView } from '../SquadView';
import { WorkstreamView } from '../WorkstreamView';
import { MissionView } from '../MissionView';
import { PriorityView } from '../PriorityView';
import { CycleView } from '../CycleView';
import { OrgView } from '../OrgView';
import { ServiceView } from '../ServiceView';
import { DecisionView } from '../DecisionView';
import { PersonView } from '../PersonView';

function makeNode(entityType: string, data: Record<string, unknown>): KBNode {
  const id = `kg://test/${entityType}`;
  return {
    id,
    title: (data.name as string) ?? id,
    cluster: entityType,
    content: '',
    rawContent: '',
    display: 'entity',
    connections: [],
    identity: id,
    entityType,
    source: { type: 'structured', entityType },
    data,
    jsonld: { '@id': id, '@type': entityType },
  };
}

function render(view: ViewerComponent, node: KBNode): string {
  return renderToStaticMarkup(createElement(view, { node }));
}

afterEach(() => {
  resetViewerRegistry();
  resetNodeTypeRegistry();
});

describe('spine viewers — rendering (T2.5 + T2.6 / #164, #165)', () => {
  it('SquadView renders mission, DRI and members', () => {
    const html = render(SquadView, makeNode('squad', {
      name: 'Game Assist', mission: 'Help players', dri: 'aokonkwo',
      members: ['ada', 'ben'], workstream: 'personalization-discovery',
    }));
    expect(html).toContain('Game Assist');
    expect(html).toContain('Help players');
    expect(html).toContain('aokonkwo');
    expect(html).toContain('ada');
    expect(html).toContain('Squad');
  });

  it('SquadView omits Members/Knowledge rows when those arrays are empty', () => {
    const html = render(SquadView, makeNode('squad', { name: 'Lonely Squad' }));
    expect(html).toContain('Lonely Squad');
    expect(html).not.toContain('Members');
    expect(html).not.toContain('Knowledge areas');
  });

  it('WorkstreamView renders summary and priority alignment', () => {
    const html = render(WorkstreamView, makeNode('workstream', {
      name: 'Personalization Discovery', summary: 'Rank content', priority: 'p0-latency',
    }));
    expect(html).toContain('Personalization Discovery');
    expect(html).toContain('p0-latency');
  });

  it('MissionView renders status/RAG pills, metrics and milestones', () => {
    const html = render(MissionView, makeNode('mission', {
      name: 'Q1 Uplift', status: 'on-track', rag: 'green',
      metrics: [{ name: 'p99 latency', target: '200ms', current: '240ms' }],
      milestones: [{ name: 'Instrumentation', done: true }, { name: 'Cache warming', done: false }],
    }));
    expect(html).toContain('Q1 Uplift');
    expect(html).toContain('kb-pill');
    expect(html).toContain('p99 latency');
    expect(html).toContain('Instrumentation');
  });

  it('PriorityView renders rank and description', () => {
    const html = render(PriorityView, makeNode('priority', { name: 'P0 — Latency', rank: 0, description: 'Sub-250ms' }));
    expect(html).toContain('P0');
    expect(html).toContain('Sub-250ms');
  });

  it('CycleView renders start and end', () => {
    const html = render(CycleView, makeNode('cycle', { name: 'Cycle 2', start: '2026-01-05', end: '2026-03-27' }));
    expect(html).toContain('Cycle 2');
    expect(html).toContain('2026-01-05');
    expect(html).toContain('dateTime="2026-01-05"');
  });

  it('CycleView omits Starts/Ends rows when dates are absent', () => {
    const html = render(CycleView, makeNode('cycle', { name: 'Undated Cycle' }));
    expect(html).toContain('Undated Cycle');
    expect(html).not.toContain('Starts');
    expect(html).not.toContain('Ends');
  });

  it('OrgView renders the charter', () => {
    const html = render(OrgView, makeNode('org', { name: 'Personalization', charter: 'Hand-crafted experiences' }));
    expect(html).toContain('Personalization');
    expect(html).toContain('Hand-crafted experiences');
  });

  it('ServiceView renders ownership, ServiceTree link, catalog-info and repo (#275)', () => {
    const html = render(ServiceView, makeNode('service', {
      name: 'KB Explorer Web', description: 'Static web frontend',
      team: 'graph-platform',
      serviceTreeId: '7e4a1c20-91a2-4d3e-9f0b-2c6d8e1a4b55',
      serviceTreeUrl: 'https://servicetree.msftcloudes.com/#/svc/7e4a1c20',
      catalogInfoPath: 'services/kb-explorer-web/catalog-info.yaml',
      repoPath: 'anokye-labs/kbexplorer-template',
      repoUrl: 'https://github.com/anokye-labs/kbexplorer-template',
      'systems-of-record': ['gh-repo'],
    }));
    expect(html).toContain('Service');
    expect(html).toContain('KB Explorer Web');
    expect(html).toContain('Owned by');
    expect(html).toContain('graph-platform');
    // ServiceTree id surfaced inside the catalog link
    expect(html).toContain('href="https://servicetree.msftcloudes.com/#/svc/7e4a1c20"');
    expect(html).toContain('7e4a1c20-91a2-4d3e-9f0b-2c6d8e1a4b55');
    expect(html).toContain('services/kb-explorer-web/catalog-info.yaml');
    expect(html).toContain('href="https://github.com/anokye-labs/kbexplorer-template"');
    expect(html).toContain('gh-repo');
  });

  it('ServiceView falls back to a code-rendered ServiceTree id when no URL is present (#275)', () => {
    const html = render(ServiceView, makeNode('service', {
      name: 'Catalog Only', team: 'graph-platform',
      serviceTreeId: 'abc-123',
    }));
    expect(html).toContain('abc-123');
    expect(html).not.toContain('<a');
  });

  it('ServiceView resolves inline-object FK entries for team + systems-of-record (#275 review)', () => {
    const html = render(ServiceView, makeNode('service', {
      name: 'Object Refs Service',
      team: { id: 'graph-platform', name: 'Graph Platform' },
      'systems-of-record': [
        { id: 'gh-repo', name: 'GitHub Repo' },
        'gh-issues',
        { name: 'No Id Here' }, // bad-ref shape (builder diagnoses) → still has a usable name
        { url: 'https://x' },    // neither name nor id → dropped, no blank list item
      ],
    }));
    // inline-object team renders its name, not "[object Object]"
    expect(html).toContain('Graph Platform');
    expect(html).not.toContain('[object Object]');
    // usable entries render; unusable ones are dropped (no empty <li>)
    expect(html).toContain('GitHub Repo');
    expect(html).toContain('gh-issues');
    expect(html).toContain('No Id Here');
    expect(html).not.toContain('<li></li>');
  });

  it('DecisionView renders deciders, status pill and context (#275)', () => {
    const html = render(DecisionView, makeNode('decision', {
      name: 'ADR-001: Adopt schema-driven content model',
      status: 'accepted',
      context: 'The spine was hardcoded per org.',
      date: '2026-02-12',
      deciders: ['adwoa', 'kwame'],
      'affects-workstreams': ['kb-explorer'],
      'affects-missions': ['q1-uplift'],
    }));
    expect(html).toContain('Decision');
    expect(html).toContain('ADR-001');
    expect(html).toContain('kb-pill');
    expect(html).toContain('The spine was hardcoded per org.');
    expect(html).toContain('Deciders');
    expect(html).toContain('adwoa');
    expect(html).toContain('kwame');
    // both affected workstreams and missions are listed under Affects
    expect(html).toContain('kb-explorer');
    expect(html).toContain('q1-uplift');
  });

  it('DecisionView omits Deciders/Affects rows when those arrays are empty (#275)', () => {
    const html = render(DecisionView, makeNode('decision', { name: 'Bare ADR', status: 'proposed' }));
    expect(html).toContain('Bare ADR');
    expect(html).not.toContain('Deciders');
    expect(html).not.toContain('Affects');
  });

  it('DecisionView resolves inline-object FK entries for deciders + affects (#275 review)', () => {
    const html = render(DecisionView, makeNode('decision', {
      name: 'Object Refs ADR', status: 'accepted',
      deciders: [{ id: 'adwoa', name: 'Adwoa Mensah' }, 'kwame', { url: 'https://x' }],
      'affects-workstreams': [{ id: 'kb-explorer', name: 'KB Explorer' }],
      'affects-missions': ['q1-uplift'],
    }));
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('Adwoa Mensah'); // inline-object decider → name
    expect(html).toContain('kwame');        // scalar decider
    expect(html).toContain('KB Explorer');  // inline-object affected workstream → name
    expect(html).toContain('q1-uplift');    // scalar affected mission
    expect(html).not.toContain('<li></li>'); // unusable { url } entry dropped
  });
});

describe('spine viewers — registration + resolution (#164, #165)', () => {
  it('registers a viewer for every spine kind and resolves each to its bespoke view', () => {
    registerContentModelTypes();
    const expected: Record<string, ViewerComponent> = {
      squad: SquadView, workstream: WorkstreamView, mission: MissionView,
      priority: PriorityView, cycle: CycleView, org: OrgView,
      service: ServiceView, decision: DecisionView,
    };
    for (const k of CONTENT_MODEL_KINDS) {
      const node = makeNode(k.id, { name: k.label });
      const resolved = resolveViewer(node);
      if (expected[k.id]) {
        expect(resolved).toBe(expected[k.id]);
      }
      expect(typeof resolved).toBe('function');
    }
  });
});

describe('PersonView — navigable reporting-line links (C1 / #278)', () => {
  const LD_CONTEXT = {
    '@base': 'kg://xbox.com/',
    person: 'kg://xbox.com/people/',
    team: 'kg://xbox.com/teams/',
  };

  /** A content-model person descriptor node carrying the JSON-LD @context. */
  function personNode(data: Record<string, unknown>): KBNode {
    const id = 'kg://xbox.com/people/ben';
    return {
      ...makeNode('person', data),
      id,
      identity: id,
      jsonld: { '@id': id, '@type': 'person', '@context': LD_CONTEXT },
    };
  }

  it('renders the manager (Reports to) value as a link to the person node', () => {
    const html = render(PersonView, personNode({ name: 'Ben Carter', manager: 'ada' }));
    expect(html).toContain('Reports to');
    expect(html).toContain('data-node-id="kg://xbox.com/people/ada"');
    expect(html).toContain('href="#/node/kg%3A%2F%2Fxbox.com%2Fpeople%2Fada"');
  });

  it('renders the team value as a link to the team node', () => {
    const html = render(PersonView, personNode({ name: 'Ben Carter', team: 'graph-platform' }));
    expect(html).toContain('data-node-id="kg://xbox.com/teams/graph-platform"');
    expect(html).toContain('href="#/node/kg%3A%2F%2Fxbox.com%2Fteams%2Fgraph-platform"');
  });

  it('expands a CURIE manager reference via the context prefix', () => {
    const html = render(PersonView, personNode({ name: 'Ben Carter', manager: 'person:ada' }));
    expect(html).toContain('data-node-id="kg://xbox.com/people/ada"');
  });

  it('falls back to plain text when the node carries no @context (work-derived person)', () => {
    const node = makeNode('person', { name: '@octocat', manager: 'ada', team: 'graph-platform' });
    node.jsonld = { '@id': node.id, '@type': 'person' }; // no @context
    const html = render(PersonView, node);
    expect(html).toContain('Reports to');
    expect(html).toContain('ada');
    expect(html).toContain('graph-platform');
    expect(html).not.toContain('data-node-id');
  });
});
