/**
 * `spa` representation (Phase 6 / F6 #335).
 *
 * The interactive explorer website is just one representation of the pure
 * `KBGraph` — the same graph the `json-ld` and `llm-context` targets consume.
 * This module owns the SPA's graph→views rendering path and registers it as the
 * `spa` target so it is selectable through the {@link RepresentationRegistry}
 * alongside the other targets, rather than being the only hardcoded output.
 *
 * It is a behavior-preserving extraction: the route table below is exactly the
 * one `App` rendered inline before, so the live site renders byte-identically.
 * Data loading stays in the app shell (`useKnowledgeBase`); the representation
 * receives the already-built graph and never refetches a system of record.
 */
/* eslint-disable react-refresh/only-export-components --
 * This is a representation-target module, not a hot-reloadable component file:
 * it intentionally exports the render function and `spa` target descriptor
 * alongside the route tree's internal component. Fast Refresh does not apply.
 */
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import type { Theme as FluentTheme } from '@fluentui/react-components';
import type {
  Representation,
  RepresentationOptions,
} from '@anokye-labs/kbexplorer-core';
import type { KBConfig, KBGraph } from '../../types';
import { ReadingView } from '../../views/ReadingView';
import { OverviewView } from '../../views/OverviewView';
import { HomePage } from '../../views/HomePage';

function ReadingRoute({
  graph,
  config,
  theme,
}: {
  graph: KBGraph;
  config: KBConfig;
  theme: FluentTheme;
}) {
  const { id } = useParams<{ id: string }>();
  return <ReadingView graph={graph} config={config} nodeId={id ?? ''} theme={theme} />;
}

/** Runtime context the SPA view tree needs beyond the pure graph. */
export interface SpaRenderOptions extends RepresentationOptions {
  config: KBConfig;
  fluentTheme: FluentTheme;
  landingPath: string;
}

/** Render the explorer's route table for an already-built graph. */
export function renderSpaRoutes(
  graph: KBGraph,
  options: SpaRenderOptions,
): ReactNode {
  const { config, fluentTheme, landingPath } = options;
  return (
    <Routes>
      <Route path="/" element={<Navigate to={landingPath} replace />} />
      <Route path="/node/home" element={<HomePage graph={graph} config={config} />} />
      <Route path="/overview" element={<OverviewView graph={graph} config={config} />} />
      <Route path="/node/:id" element={<ReadingRoute graph={graph} config={config} theme={fluentTheme} />} />
      <Route path="*" element={<Navigate to={landingPath} replace />} />
    </Routes>
  );
}

/** The registered `spa` representation target. */
export const spaRepresentation: Representation<ReactNode> = {
  target: 'spa',
  render(graph, options) {
    return renderSpaRoutes(graph, options as SpaRenderOptions);
  },
};
