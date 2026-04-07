import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
import { FluentProvider } from '@fluentui/react-components';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useTheme } from './hooks/useTheme';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { HUD } from './components/HUD';
import type { DockPosition } from './components/HUD';
import { ReadingView } from './views/ReadingView';
import { OverviewView } from './views/OverviewView';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import './styles/visuals.css';
import './styles/overview.css';
import './styles/reading.css';
import './styles/responsive.css';

function ReadingRoute({ graph, config }: { graph: import('./types').KBGraph; config: import('./types').KBConfig }) {
  const { id } = useParams<{ id: string }>();
  return <ReadingView graph={graph} config={config} nodeId={id ?? ''} />;
}

function useCurrentNodeId(): string | null {
  const [nodeId, setNodeId] = useState<string | null>(null);

  useEffect(() => {
    function update() {
      const match = window.location.hash.match(/#\/node\/(.+)/);
      setNodeId(match ? decodeURIComponent(match[1]) : null);
    }
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return nodeId;
}

function Explorer({ themeMode, setThemeMode }: { themeMode: import('./hooks/useTheme').ThemeMode; setThemeMode: (t: import('./hooks/useTheme').ThemeMode) => void }) {
  const state = useKnowledgeBase();
  const currentNodeId = useCurrentNodeId();

  const [hudCollapsed, setHudCollapsed] = useState(() => {
    try { return localStorage.getItem('kbe-hud-collapsed') === 'true'; } catch { return false; }
  });
  const [hudDock, setHudDock] = useState<DockPosition>(() => {
    try { return (localStorage.getItem('kbe-hud-dock') ?? 'bottom') as DockPosition; } catch { return 'bottom'; }
  });

  useKeyboardNav(
    state.status === 'ready' ? state.graph : null,
    setThemeMode as (t: import('./types').Theme) => void,
  );

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error} />;

  const { graph, config } = state;

  const paddingSize = hudCollapsed ? 40 : (hudDock === 'left' || hudDock === 'right' ? 240 : 156);
  const paddingStyle = hudDock === 'top' ? { paddingTop: paddingSize }
    : hudDock === 'left' ? { paddingLeft: paddingSize }
    : hudDock === 'right' ? { paddingRight: paddingSize }
    : { paddingBottom: paddingSize };

  return (
    <>
      <div style={paddingStyle}>
        <Routes>
          <Route path="/" element={<OverviewView graph={graph} config={config} />} />
          <Route path="/node/:id" element={<ReadingRoute graph={graph} config={config} />} />
        </Routes>
      </div>
      <HUD
          graph={graph}
          config={config}
          currentNodeId={currentNodeId}
          theme={themeMode}
          onThemeChange={setThemeMode as (t: import('./types').Theme) => void}
          onCollapsedChange={setHudCollapsed}
          onDockChange={setHudDock}
        />
    </>
  );
}

function App() {
  const [themeMode, fluentTheme, setThemeMode] = useTheme();

  return (
    <FluentProvider theme={fluentTheme} style={{ minHeight: '100vh' }}>
      <HashRouter>
        <Explorer themeMode={themeMode} setThemeMode={setThemeMode} />
      </HashRouter>
    </FluentProvider>
  );
}

export default App;
