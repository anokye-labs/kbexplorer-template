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
 * Agent action surface (#409): a `useCanvasEvents` subscription applies the two
 * frozen `/events` domain events regardless of `boot.target` (both `copilot`
 * and `spa` mount a `HashRouter`, so hash navigation is the shared seam):
 * `anchor { nodeId }` re-anchors via `location.hash`, and `graph-updated
 * { nodes }` patches the live in-memory graph so the current view re-renders.
 * See `useCanvasEvents.ts` for the frozen-vs-deferred event scope.
 */
import { useState, type ReactNode } from 'react';
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
  const [prevLoadedGraph, setPrevLoadedGraph] = useState(loadedGraph);
  if (loadedGraph !== prevLoadedGraph) {
    setPrevLoadedGraph(loadedGraph);
    setLiveGraph(loadedGraph);
  }

  const eventsUrl = resolveEventsUrl(boot);
  useCanvasEvents(eventsUrl, {
    onAnchor: nodeId => {
      window.location.hash = `#/node/${encodeURIComponent(nodeId)}`;
    },
    onGraphUpdated: payload => {
      setLiveGraph(current => (current ? applyGraphUpdatedEvent(current, payload) : current));
    },
    // No onError: `/events` is expected to fail to connect entirely outside a
    // loopback host (this repo's own `vite preview`/e2e/dev server has no such
    // endpoint) — that's the documented safe-degrade path, not an app error.
  });

  const graph = liveGraph ?? loadedGraph;

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
