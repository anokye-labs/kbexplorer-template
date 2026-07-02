/**
 * `copilot` representation (B1 #440 + B2 #408, epic #407 / #401).
 *
 * The destination surface for Copilot: a distinct {@link RepresentationTarget}
 * the embeddable canvas resolves so the panel can render a Copilot-bespoke view
 * of the SAME pure `KBGraph` the `spa` target renders. Registering it as its own
 * named target — rather than reusing `spa` from the canvas mount — gives the
 * bespoke children a stable seam to build on.
 *
 * #440 registered the target (initially delegating to the `spa` route tree).
 * #408 replaces that delegation with the **anchor-first** layout: the landing
 * view is NOT the constellation but the conversation's anchor node
 * ({@link AnchorFirstView}) — its existing node-type viewer plus its
 * weight-ranked neighbors (top-ranked expanded inline, the rest as navigable
 * `kg://` chips), with the constellation demoted to an optional zoom-out. The
 * registration/wiring #440 put in place is unchanged; only the render body is.
 *
 * #453 replaces the zoom-out's render target: `/constellation` now renders
 * {@link ConstellationView} — a full-viewport, interactive force-directed
 * graph (drag-pan, scroll-zoom, click-to-re-anchor) — instead of `HomePage`,
 * the SPA's decorative, non-interactive landing hero.
 *
 * ADDITIVE: the `spa` target and the full-page `App`/`main.tsx` path are
 * untouched — this owns its OWN narrow `<Routes>` inside the mount's HashRouter.
 */
/* eslint-disable react-refresh/only-export-components --
 * This is a representation-target module, not a hot-reloadable component file:
 * it intentionally exports the render function and `copilot` target descriptor
 * alongside the route tree's internal components. Fast Refresh does not apply.
 */
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import type { Representation } from '@anokye-labs/kbexplorer-core';
import type { KBConfig, KBGraph } from '../../types';
import { OverviewView } from '../../views/OverviewView';
import type { SpaRenderOptions } from './spa';
import { AnchorFirstView } from './copilot-home/AnchorFirstView';
import { ConstellationView } from './copilot-home/ConstellationView';
import { CanvasShell } from '../../canvas/CanvasShell';

/**
 * Runtime context the copilot view needs beyond the pure graph. Widens
 * {@link SpaRenderOptions} (#408) with the conversation `anchorNodeId` the
 * anchor-first home lands on; `landingPath` remains the no-anchor fallback.
 */
export interface CopilotRenderOptions extends SpaRenderOptions {
  /** The conversation anchor node id from `bootConfig.anchorNodeId`, if any. */
  anchorNodeId?: string;
}

/** Route element: anchor-first home for the `:id` in the hash path. */
function AnchorRoute({ graph, config }: { graph: KBGraph; config: KBConfig }) {
  const { id } = useParams<{ id: string }>();
  return <AnchorFirstView graph={graph} config={config} anchorId={id ?? ''} />;
}

/**
 * Render the copilot surface for an already-built graph.
 *
 * The initial path is the conversation anchor (`/node/<anchorNodeId>`) when the
 * boot config supplies one, else the repo's configured `landingPath` (NO-ANCHOR
 * fallback — {@link AnchorFirstView} degrades an unknown landing node, e.g.
 * `/node/home`, to the constellation). Every `/node/:id` re-anchors the view, so
 * clicking a `kg://` neighbor chip re-centers the panel. `/constellation` is the
 * optional zoom-out (the full-viewport, interactive {@link ConstellationView}).
 *
 * Every route renders inside the {@link CanvasShell} (#412) — the narrow
 * ~400px-friendly column with consistent vertical rhythm and host-token-only
 * styling that #409–#411 build on top of. The shell wraps `<Routes>` itself
 * (not each `<Route>` individually) so route transitions never remount it.
 */
export function renderCopilotSurface(
  graph: KBGraph,
  options: CopilotRenderOptions,
): ReactNode {
  const { config, landingPath, anchorNodeId } = options;
  const initialPath = anchorNodeId
    ? `/node/${encodeURIComponent(anchorNodeId)}`
    : landingPath;

  return (
    <CanvasShell>
      <Routes>
        <Route path="/" element={<Navigate to={initialPath} replace />} />
        <Route path="/node/:id" element={<AnchorRoute graph={graph} config={config} />} />
        <Route path="/constellation" element={<ConstellationView graph={graph} config={config} />} />
        <Route path="/overview" element={<OverviewView graph={graph} config={config} />} />
        <Route path="*" element={<Navigate to={initialPath} replace />} />
      </Routes>
    </CanvasShell>
  );
}

/** The registered `copilot` representation target. */
export const copilotRepresentation: Representation<ReactNode> = {
  target: 'copilot',
  render(graph, options) {
    return renderCopilotSurface(graph, options as CopilotRenderOptions);
  },
};
