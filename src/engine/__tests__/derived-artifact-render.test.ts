/**
 * Cross-repo derived-artifact render proof (F4 — folded in from F8).
 *
 * The `kbexplorer` CLI (`kbexplorer derive`, sibling repo) emits committed
 * `*.jsonld` artifacts that mirror the F1 `KBNode` contract: an `entityType`,
 * a JSON-LD envelope whose `@id` reuses the identity URN (e.g. `kg://person/jane`),
 * a structured `data` bag, and taxonomy relations (`reports-to` / `leads` / …)
 * carried as `connections`.
 *
 * F8 could not verify cross-repo that this engine actually *renders* a CLI-emitted
 * artifact (the CLI source isn't in this repo). This test closes that gap using
 * committed fixture artifacts: it loads them, runs them through the engine's graph
 * assembler + type/viewer registries, and asserts each resolves to a structured
 * node bound to its **bespoke** viewer with the JSON-LD identity and relations
 * intact — end-to-end through the engine.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KBNode, Cluster } from '../../types';
import { buildGraph, resolveType, resetNodeTypeRegistry, registerContentModelTypes } from '@anokye-labs/kbexplorer-engine';
import { registerBuiltinViewers, resolveViewer, resetViewerRegistry } from '../../views/viewers';
import { PersonView } from '../../views/viewers/PersonView';
import { SquadView } from '../../views/viewers/SquadView';

const here = dirname(fileURLToPath(import.meta.url));
const DERIVED_DIR = join(here, 'fixtures', 'derived');

/** Load every committed `*.jsonld` derived artifact as a KBNode mirror. */
function loadDerivedArtifacts(): KBNode[] {
  return readdirSync(DERIVED_DIR)
    .filter(f => f.endsWith('.jsonld'))
    .sort()
    .map(f => JSON.parse(readFileSync(join(DERIVED_DIR, f), 'utf-8')) as KBNode);
}

const CLUSTERS: Cluster[] = [{ id: 'org', name: 'Organization', color: '#c0a3ff' }];

describe('derived-artifact render proof (cross-repo, F8 gap)', () => {
  beforeAll(() => {
    // Registering the content-model spine binds person→PersonView, squad→SquadView.
    registerBuiltinViewers();
    registerContentModelTypes();
  });
  afterAll(() => {
    // registerContentModelTypes() populates both the node-type and viewer
    // registries; reset both so viewer registrations don't leak into other tests.
    resetNodeTypeRegistry();
    resetViewerRegistry();
  });

  it('every artifact honors the F1 JSON-LD identity contract (@id === identity URN)', () => {
    const artifacts = loadDerivedArtifacts();
    expect(artifacts.length).toBeGreaterThanOrEqual(3);
    for (const node of artifacts) {
      expect(node.entityType).toBeTruthy();
      expect(node.jsonld?.['@id']).toBe(node.identity);
      expect(String(node.jsonld?.['@id'])).toMatch(/^kg:\/\//);
    }
  });

  it('resolves each derived node to its bespoke viewer through the registry', () => {
    const byId = new Map(loadDerivedArtifacts().map(n => [n.id, n]));
    const jane = byId.get('kg://person/jane')!;
    const sam = byId.get('kg://person/sam')!;
    const squad = byId.get('kg://squad/platform-core')!;

    expect(resolveType(jane.entityType!)?.viewer).toBe('person');
    expect(resolveType(squad.entityType!)?.viewer).toBe('squad');

    expect(resolveViewer(jane)).toBe(PersonView);
    expect(resolveViewer(sam)).toBe(PersonView);
    expect(resolveViewer(squad)).toBe(SquadView);
  });

  it('assembles into a graph preserving the reports-to / leads taxonomy relations', () => {
    const graph = buildGraph(loadDerivedArtifacts(), CLUSTERS);

    const reportsTo = graph.edges.find(
      e => e.from === 'kg://person/jane' && e.to === 'kg://person/sam',
    );
    expect(reportsTo?.relation).toBe('reports-to');

    const leads = graph.edges.find(
      e => e.from === 'kg://person/jane' && e.to === 'kg://squad/platform-core',
    );
    expect(leads?.relation).toBe('leads');

    // The structured data bag survives assembly (viewers read it).
    const jane = graph.nodes.find(n => n.id === 'kg://person/jane')!;
    expect(jane.data?.role).toBe('Staff Engineer');
  });
});
