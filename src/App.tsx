import { useCallback, useEffect, useState } from 'react';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import { FluentProvider, type Theme as FluentTheme } from '@fluentui/react-components';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useTheme, isDarkTheme } from './hooks/useTheme';
import { IsDarkContext } from './theme/isDarkContext';
import { useThemeFonts } from './hooks/useThemeFonts';
import { useFavicon } from './hooks/useFavicon';
import { useCssOverride, isAbsoluteUrl } from './hooks/useCssOverride';
import { loadThemeModule, applyThemeModuleInOrder } from './theme/themeModule';
import { resolveImageUrl } from './api';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { resolveLandingPath, resolveLandingHudCollapsed } from './landing/resolveLanding';
import { HUD } from './components/HUD';
import type { DockPosition } from './components/HUD';
import { SearchPalette } from './components/SearchPalette';
import { useSearchIndex } from './search/useSearchIndex';
import type { ReactNode } from 'react';
import { representationRegistry } from './representation';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import './styles/visuals.css';
import './styles/reading.css';
import './styles/responsive.css';

function useCurrentNodeId(): string | null {
  const location = useLocation();
  const match = location.pathname.match(/^\/node\/(.+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function Explorer({ themeMode, fluentTheme, isDark, setThemeMode, applyConfig, cycleTheme, availableThemes }: { themeMode: import('./hooks/useTheme').ThemeMode; fluentTheme: FluentTheme; isDark: boolean; setThemeMode: (t: import('./hooks/useTheme').ThemeMode) => void; applyConfig: (theme?: import('./types').KBConfig['theme'], moduleThemes?: Record<string, FluentTheme>) => void; cycleTheme: () => void; availableThemes: import('./hooks/useTheme').ThemeMode[] }) {
  const state = useKnowledgeBase();
  const currentNodeId = useCurrentNodeId();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status !== 'ready') return;
    const theme = state.config.theme;
    const moduleUrl = theme?.moduleUrl;
    // No module configured: pure no-op — just build the config-only THEME_MAP,
    // keeping the security-sensitive dynamic import strictly opt-in.
    if (!moduleUrl) {
      applyConfig(theme);
      return;
    }
    // T5.3: a host repo opted into a custom JS theme module. Resolve a
    // repo-relative path like other host assets (in remote mode this is a
    // cross-origin raw host URL); an absolute URL is used verbatim.
    // applyThemeModuleInOrder applies the config-only map IMMEDIATELY, then
    // re-applies the merged map once the import lands — so the UI never lingers
    // on the built-in map, and a slow/failed import is a safe no-op.
    let cancelled = false;
    const url = isAbsoluteUrl(moduleUrl) ? moduleUrl : resolveImageUrl(state.config.source, moduleUrl);
    const guardedApply = (t?: import('./types').KBConfig['theme'], m?: Record<string, FluentTheme>) => {
      if (!cancelled) applyConfig(t, m);
    };
    void applyThemeModuleInOrder(
      theme,
      () => loadThemeModule(url, { name: theme.moduleThemeName }),
      guardedApply,
    );
    return () => { cancelled = true; };
  }, [state, applyConfig]);

  const [hudDock, setHudDock] = useState<DockPosition>(() => {
    try { return (localStorage.getItem('kbe-hud-dock') ?? 'bottom') as DockPosition; } catch { return 'bottom'; }
  });

  const [storedHudCollapsed] = useState<string | null>(() => {
    try { return localStorage.getItem('kbe-hud-collapsed'); } catch { return null; }
  });
  const [userHudCollapsed, setUserHudCollapsed] = useState<boolean | undefined>(() =>
    storedHudCollapsed === null ? undefined : storedHudCollapsed === 'true',
  );

  // Whether this load is a true landing (root URL, no deep-link hash) vs a
  // deep link (#/node/x, #/overview). Captured once from the initial hash so
  // deep links bypass landing config — including the HUD-collapse default.
  const [isRootLanding] = useState(() => {
    let h = '';
    try { h = window.location.hash; } catch { /* ignore */ }
    return h === '' || h === '#' || h === '#/';
  });

  // Landing-mode initial HUD collapsed state (#238).
  // Computed once on the first 'ready' render (the render that mounts HUD
  // for the first time) and passed as `initialCollapsed` to HUD so it starts
  // in the right state without a flash. On a deep link, landing config is
  // bypassed: only the user's stored preference applies (config.landing.graph
  // must not force a deep-linked visitor's HUD closed).
  const hudInitialCollapsed = state.status === 'ready'
    ? isRootLanding
      ? resolveLandingHudCollapsed(state.config, storedHudCollapsed)
      : storedHudCollapsed === 'true'
    : undefined;
  const hudCollapsed = userHudCollapsed ?? hudInitialCollapsed ?? false;

  // ── Search palette ─────────────────────────────────────────
  // Host repos can opt out via `features.search: false` in config.yaml.
  // Unset means enabled (the flag is optional/additive), and loadConfig's
  // shallow merge means a host `features:` block without `search` still
  // resolves to undefined here — so check `!== false`, not truthiness.
  const searchEnabled = state.status !== 'ready' || state.config.features?.search !== false;
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const handleSearchNavigate = useCallback((nodeId: string) => {
    navigate(`/node/${encodeURIComponent(nodeId)}`);
  }, [navigate]);

  const searchIndex = useSearchIndex(
    state.status === 'ready' && searchEnabled ? state.graph.nodes : []
  );

  useKeyboardNav(
    state.status === 'ready' ? state.graph : null,
    cycleTheme,
    searchEnabled ? openSearch : undefined,
  );

  useThemeFonts(state.status === 'ready' ? state.config.theme.font : undefined);

  useFavicon(state.status === 'ready' ? state.config : undefined);

  useCssOverride(state.status === 'ready' ? state.config : undefined);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error} />;

  const { graph, config } = state;

  const sidebarVw = (() => { try { const v = localStorage.getItem('kbe-sidebar-w'); return v ? Number(v) : 25; } catch { return 25; } })();
  const paddingSize = hudCollapsed ? 40 : (hudDock === 'left' || hudDock === 'right' ? 0 : 156);
  const paddingStyle: React.CSSProperties = hudDock === 'top' ? { paddingTop: paddingSize }
    : hudDock === 'left' ? { paddingLeft: hudCollapsed ? 40 : `var(--kbe-sidebar-width, ${sidebarVw}vw)` }
    : hudDock === 'right' ? { paddingRight: hudCollapsed ? 40 : `var(--kbe-sidebar-width, ${sidebarVw}vw)` }
    : { paddingBottom: paddingSize };

  const landingPath = resolveLandingPath(config);

  // Render the graph through the `spa` representation, selected by name from the
  // registry — the same pure graph the json-ld / llm-context targets consume.
  // The `spa` target renders synchronously to a ReactNode; the registry's
  // generic render signature allows async targets, so narrow it here.
  const spaView = representationRegistry
    .resolve<ReactNode>('spa')
    .render(graph, { config, fluentTheme, landingPath }) as ReactNode;

  return (
    <>
      <div style={paddingStyle}>{spaView}</div>
      <HUD
          graph={graph}
          config={config}
          currentNodeId={currentNodeId}
          theme={themeMode}
          isDark={isDark}
          availableThemes={availableThemes}
          onThemeChange={setThemeMode}
          onCollapsedChange={setUserHudCollapsed}
          onDockChange={setHudDock}
          onOpenSearch={searchEnabled ? openSearch : undefined}
          initialCollapsed={hudInitialCollapsed}
        />
      {searchEnabled && searchOpen && (
        <SearchPalette
          index={searchIndex}
          onClose={closeSearch}
          onNavigate={handleSearchNavigate}
        />
      )}
    </>
  );
}

function App() {
  const [themeMode, fluentTheme, setThemeMode, applyConfig, cycleTheme, availableThemes] = useTheme();
  const isDark = isDarkTheme(fluentTheme);

  return (
    <FluentProvider theme={fluentTheme} style={{ minHeight: '100vh' }}>
      <IsDarkContext.Provider value={isDark}>
        <HashRouter>
          <Explorer themeMode={themeMode} fluentTheme={fluentTheme} isDark={isDark} setThemeMode={setThemeMode} applyConfig={applyConfig} cycleTheme={cycleTheme} availableThemes={availableThemes} />
        </HashRouter>
      </IsDarkContext.Provider>
    </FluentProvider>
  );
}

export default App;
