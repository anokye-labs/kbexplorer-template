import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KBNode } from '../../../types';
import { resolveViewer, resetViewerRegistry, type ViewerComponent } from '../index';
import { registerContentModelTypes, CONTENT_MODEL_KINDS } from '../../../engine/content-model';
import { SquadView } from '../SquadView';
import { WorkstreamView } from '../WorkstreamView';
import { MissionView } from '../MissionView';
import { PriorityView } from '../PriorityView';
import { CycleView } from '../CycleView';
import { OrgView } from '../OrgView';

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

afterEach(() => resetViewerRegistry());

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
  });

  it('OrgView renders the charter', () => {
    const html = render(OrgView, makeNode('org', { name: 'Personalization', charter: 'Hand-crafted experiences' }));
    expect(html).toContain('Personalization');
    expect(html).toContain('Hand-crafted experiences');
  });
});

describe('spine viewers — registration + resolution (#164, #165)', () => {
  it('registers a viewer for every spine kind and resolves each to its bespoke view', () => {
    registerContentModelTypes();
    const expected: Record<string, ViewerComponent> = {
      squad: SquadView, workstream: WorkstreamView, mission: MissionView,
      priority: PriorityView, cycle: CycleView, org: OrgView,
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
