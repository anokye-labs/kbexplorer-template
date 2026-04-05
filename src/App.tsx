import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
import { FluentProvider } from '@fluentui/react-components';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useTheme } from './hooks/useTheme';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { HUD } from './components/HUD';
import { ReadingView } from './views/ReadingView';
import GraphView from './views/GraphView';
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

function useIsGraphRoute(): boolean {
  const [isGraph, setIsGraph] = useState(false);

  useEffect(() => {
    function update() {
      setIsGraph(window.location.hash === '#/graph');
    }
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return isGraph;
}

function Explorer() {
  const state = useKnowledgeBase();
  const [themeMode, , setThemeMode] = useTheme();
  const currentNodeId = useCurrentNodeId();
  const isGraph = useIsGraphRoute();

  useKeyboardNav(
    state.status === 'ready' ? state.graph : null,
    setThemeMode as (t: import('./types').Theme) => void,
  );

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error} />;

  const { graph, config } = state;

  return (
    <>
      <div style={{ paddingBottom: isGraph ? 0 : 180 }}>
        <Routes>
          <Route path="/" element={<OverviewView graph={graph} config={config} />} />
          <Route path="/graph" element={<GraphView graph={graph} config={config} />} />
          <Route path="/node/:id" element={<ReadingRoute graph={graph} config={config} />} />
        </Routes>
      </div>
      {!isGraph && (
        <HUD
          graph={graph}
          config={config}
          currentNodeId={currentNodeId}
          theme={themeMode}
          onThemeChange={setThemeMode as (t: import('./types').Theme) => void}
        />
      )}
    </>
  );
}

function App() {
  const [, fluentTheme] = useTheme();

  return (
    <FluentProvider theme={fluentTheme} style={{ height: '100%' }}>
      <HashRouter>
        <Explorer />
      </HashRouter>
    </FluentProvider>
  );
}

export default App;
