/**
 * Embeddable headless mount (#406, epic #407 / #401).
 *
 * The canvas-mode counterpart to the full-page `App`. It renders the SAME pure
 * `KBGraph` through the SAME `spa` representation (ReadingView / OverviewView /
 * HomePage → node viewers, `kg://` identity + relations) but WITHOUT the full-
 * page chrome: no HUD, no favicon, no dock padding, no theme `t`-cycle. It is a
 * narrow, panel-friendly surface meant to sit inside a Copilot canvas iframe.
 *
 * This is ADDITIVE: the full-page `App`/`main.tsx` path is untouched. The theme
 * is host-driven via {@link useCanvasTheme} (`inherit-host`), and an optional
 * `anchorNodeId` from the boot config picks the landing node — the seam the
 * bespoke agent-driven anchor-first view (#408) builds on.
 */
import type { ReactNode } from 'react';
import { HashRouter } from 'react-router-dom';
import { FluentProvider } from '@fluentui/react-components';
import { useKnowledgeBase } from '../hooks/useKnowledgeBase';
import { isDarkTheme } from '../hooks/useTheme';
import { IsDarkContext } from '../theme/isDarkContext';
import { representationRegistry } from '../representation';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen } from '../components/ErrorScreen';
import { useCanvasTheme } from './useCanvasTheme';
import { resolveCanvasLandingPath } from './landing';
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

  return (
    <FluentProvider
      theme={fluentTheme}
      // Panel-friendly: fill the iframe, no full-page chrome/dock padding.
      style={{ minHeight: '100vh', width: '100%' }}
      data-kbx-surface="canvas"
    >
      <IsDarkContext.Provider value={isDark}>
        {state.status === 'loading' && <LoadingScreen />}
        {state.status === 'error' && <ErrorScreen message={state.error} />}
        {state.status === 'ready' && (
          <HashRouter>
            {representationRegistry.resolve<ReactNode>('spa').render(state.graph, {
              config: state.config,
              fluentTheme,
              landingPath: resolveCanvasLandingPath(state.config, boot.anchorNodeId),
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
