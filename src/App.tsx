import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { FluentProvider, type Theme as FluentTheme } from '@fluentui/react-components';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useTheme, isDarkTheme } from './hooks/useTheme';
import { useThemeFonts } from './hooks/useThemeFonts';
import { useFavicon } from './hooks/useFavicon';
import { useCssOverride } from './hooks/useCssOverride';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { HUD } from './components/HUD';
import type { DockPosition } from './components/HUD';
import { ReadingView } from './views/ReadingView';
import { OverviewView } from './views/OverviewView';
import { HomePage } from './views/HomePage';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import './styles/visuals.css';
import './styles/reading.css';
import './styles/responsive.css';

function ReadingRoute({ graph, config, theme }: { graph: import('./types').KBGraph; config: import('./types').KBConfig; theme: FluentTheme }) {
  const { id } = useParams<{ id: string }>();
  return <ReadingView graph={graph} config={config} nodeId={id ?? ''} theme={theme} />;
}

function useCurrentNodeId(): string | null {
  const location = useLocation();
  const match = location.pathname.match(/^\/node\/(.+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function Explorer({ themeMode, fluentTheme, isDark, setThemeMode, applyConfig, cycleTheme }: { themeMode: import('./hooks/useTheme').ThemeMode; fluentTheme: FluentTheme; isDark: boolean; setThemeMode: (t: import('./hooks/useTheme').ThemeMode) => void; applyConfig: (theme?: import('./types').KBConfig['theme']) => void; cycleTheme: () => void }) {
  const state = useKnowledgeBase();
  const currentNodeId = useCurrentNodeId();

  useEffect(() => {
    if (state.status === 'ready') {
      applyConfig(state.config.theme);
    }
  }, [state, applyConfig]);

  const [hudCollapsed, setHudCollapsed] = useState(() => {
    try { return localStorage.getItem('kbe-hud-collapsed') === 'true'; } catch { return false; }
  });
  const [hudDock, setHudDock] = useState<DockPosition>(() => {
    try { return (localStorage.getItem('kbe-hud-dock') ?? 'bottom') as DockPosition; } catch { return 'bottom'; }
  });

  useKeyboardNav(
    state.status === 'ready' ? state.graph : null,
    cycleTheme,
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

  return (
    <>
      <div style={paddingStyle}>
        <Routes>
          <Route path="/" element={<Navigate to="/node/home" replace />} />
          <Route path="/node/home" element={<HomePage graph={graph} config={config} />} />
          <Route path="/overview" element={<OverviewView graph={graph} config={config} />} />
          <Route path="/node/:id" element={<ReadingRoute graph={graph} config={config} theme={fluentTheme} />} />
          <Route path="*" element={<Navigate to="/node/home" replace />} />
        </Routes>
      </div>
      <HUD
          graph={graph}
          config={config}
          currentNodeId={currentNodeId}
          theme={themeMode}
          isDark={isDark}
          onThemeChange={setThemeMode as (t: import('./types').Theme) => void}
          onCollapsedChange={setHudCollapsed}
          onDockChange={setHudDock}
        />
    </>
  );
}

function App() {
  const [themeMode, fluentTheme, setThemeMode, applyConfig, cycleTheme] = useTheme();
  const isDark = isDarkTheme(fluentTheme);

  return (
    <FluentProvider theme={fluentTheme} style={{ minHeight: '100vh' }}>
      <HashRouter>
        <Explorer themeMode={themeMode} fluentTheme={fluentTheme} isDark={isDark} setThemeMode={setThemeMode} applyConfig={applyConfig} cycleTheme={cycleTheme} />
      </HashRouter>
    </FluentProvider>
  );
}

export default App;
