/**
 * Embeddable headless mount (#406, epic #407 / #401).
 *
 * The canvas-mode counterpart to the full-page `App`. It renders the SAME pure
 * `KBGraph` through a registry-selected representation (`boot.target`, default
 * `copilot` — #440) but WITHOUT the full-page chrome: no HUD, no favicon, no
 * dock padding, no theme `t`-cycle. It is a narrow, panel-friendly surface meant
 * to sit inside a Copilot canvas iframe. The `copilot` target initially reuses
 * the spa viewers (ReadingView / OverviewView / HomePage → node viewers,
 * `kg://` identity + relations); the bespoke anchor-first layout lands in #408.
 *
 * This is ADDITIVE: the full-page `App`/`main.tsx` path is untouched. The theme
 * is host-driven via {@link useCanvasTheme} (`inherit-host`), and an optional
 * `anchorNodeId` from the boot config picks the landing node — the seam the
 * bespoke agent-driven anchor-first view (#408) builds on.
 *
 * Agent action surface (#409): a `useCanvasEvents` subscription applies the
 * frozen `/events` domain events regardless of `boot.target` (both `copilot`
 * and `spa` mount a `HashRouter`, so hash navigation is the shared seam):
 * `anchor { nodeId }` re-anchors via `location.hash`; `graph-updated` is
 * REASON-AWARE (`kbexplorer-cli` cli#214) — a reason-less payload patches the
 * live in-memory graph ({@link applyGraphUpdatedEvent}), while `expand` /
 * `trace` / `filter` (all carried over the SAME event, distinguished by a
 * `reason` field) accumulate into a separate {@link ViewActionState}
 * ({@link applyViewAction}) that's threaded into the `copilot` target's render
 * options alongside the graph — see `viewActionState.ts` for the reducer and
 * `AnchorFirstView.tsx` for how it's consumed.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { HashRouter } from 'react-router-dom';
import { FluentProvider } from '@fluentui/react-components';
import { useKnowledgeBase } from '../hooks/useKnowledgeBase';
import { isDarkTheme } from '../hooks/useTheme';
import { IsDarkContext } from '../theme/isDarkContext';
import { representationRegistry } from '../representation';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen } from '../components/ErrorScreen';
import type { KBGraph } from '../types';
import { useCanvasTheme } from './useCanvasTheme';
import { resolveCanvasLandingPath } from './landing';
import { applyGraphUpdatedEvent, resolveEventsUrl, useCanvasEvents } from './useCanvasEvents';
import {
  applyViewAction,
  resolveFilterNodeIds,
  INITIAL_VIEW_ACTION_STATE,
  type ViewActionState,
} from './viewActionState';
import type { CanvasBootConfig } from './bootConfig';
import '../styles/visuals.css';
import '../styles/reading.css';
import '../styles/responsive.css';

/** Data-loading inner shell: renders the `spa` route tree once ready. */
function CanvasExplorer({ boot }: { boot: CanvasBootConfig }): ReactNode {
  const state = useKnowledgeBase();

  const fluentTheme = useCanvasTheme(
    boot.visualMode,
    state.status === 'ready' ? state.config : undefined,
  );
  const isDark = isDarkTheme(fluentTheme);

  // Agent action surface (#409): the live graph starts as the loaded manifest
  // and is patched in place by `graph-updated` SSE events. Reset whenever the
  // underlying loaded graph identity changes (a fresh `useKnowledgeBase` load).
  // Adjusted during render (not in an effect) per React's "adjusting state
  // when a prop changes" recipe — avoids the extra commit + re-render an
  // effect-based reset would cause, and satisfies react-hooks/set-state-in-effect.
  const loadedGraph = state.status === 'ready' ? state.graph : undefined;
  const [liveGraph, setLiveGraph] = useState<KBGraph | undefined>(loadedGraph);
  const [viewAction, setViewAction] = useState<ViewActionState>(INITIAL_VIEW_ACTION_STATE);
  const [prevLoadedGraph, setPrevLoadedGraph] = useState(loadedGraph);
  if (loadedGraph !== prevLoadedGraph) {
    setPrevLoadedGraph(loadedGraph);
    setLiveGraph(loadedGraph);
    setViewAction(INITIAL_VIEW_ACTION_STATE);
  }

  const eventsUrl = resolveEventsUrl(boot);
  useCanvasEvents(eventsUrl, {
    onAnchor: nodeId => {
      window.location.hash = `#/node/${encodeURIComponent(nodeId)}`;
    },
    onGraphUpdated: payload => {
      // Reason-aware dispatch (#409, cli#214): `expand`/`trace`/`filter` share
      // the `graph-updated` event with the reason-less content-patch shape,
      // distinguished by `reason`. Known reasons go to the view-action reducer
      // ONLY (never also patched as content — their `nodes` field is a plain
      // id array, not patch objects, so `applyGraphUpdatedEvent` would no-op
      // on it anyway, but branching explicitly keeps the two concerns apart).
      const reason = (payload as { reason?: unknown } | undefined)?.reason;
      if (reason === 'expand' || reason === 'trace' || reason === 'filter') {
        setViewAction(current => applyViewAction(current, payload));
      } else {
        setLiveGraph(current => (current ? applyGraphUpdatedEvent(current, payload) : current));
      }
    },
    // No onError: `/events` is expected to fail to connect entirely outside a
    // loopback host (this repo's own `vite preview`/e2e/dev server has no such
    // endpoint) — that's the documented safe-degrade path, not an app error.
  });

  const graph = liveGraph ?? loadedGraph;

  // Resolve the active `filter`'s effective node-id set against the CURRENT
  // graph (client-side cluster/nodeType predicate when the server sent
  // `nodes: null` — see `viewActionState.ts`). Memoized: only recomputes when
  // the filter criteria or the graph identity changes.
  const filterNodeIds = useMemo(
    () => (graph ? resolveFilterNodeIds(viewAction.filter, graph) : undefined),
    [graph, viewAction.filter],
  );

  return (
    <FluentProvider
      theme={fluentTheme}
      // Panel-friendly: fill the iframe, no full-page chrome/dock padding.
      style={{ minHeight: '100vh', width: '100%' }}
      data-kbx-surface="canvas"
      data-kbx-target={boot.target}
    >
      <IsDarkContext.Provider value={isDark}>
        {state.status === 'loading' && <LoadingScreen />}
        {state.status === 'error' && <ErrorScreen message={state.error} />}
        {state.status === 'ready' && graph && (
          <HashRouter>
            {representationRegistry.resolve<ReactNode>(boot.target).render(graph, {
              config: state.config,
              fluentTheme,
              landingPath: resolveCanvasLandingPath(state.config, boot.anchorNodeId),
              anchorNodeId: boot.anchorNodeId,
              viewAction: {
                expandedNodeIds: viewAction.expandedNodeIds,
                focusNodeId: viewAction.focusNodeId,
                trace: viewAction.trace,
                filterNodeIds,
              },
            }) as ReactNode}
          </HashRouter>
        )}
      </IsDarkContext.Provider>
    </FluentProvider>
  );
}

/** The embeddable headless application root. */
export function EmbeddableApp({ boot }: { boot: CanvasBootConfig }) {
  return <CanvasExplorer boot={boot} />;
}

export default EmbeddableApp;
