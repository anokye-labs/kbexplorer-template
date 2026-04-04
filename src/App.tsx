import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useTheme } from './hooks/useTheme';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { HUD } from './components/HUD';
import './styles/visuals.css';

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{
        width: 40, height: 40, border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-body)' }}>
        Loading knowledge base…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: '12px', padding: '2rem',
    }}>
      <span style={{ fontSize: 48 }}>⚠️</span>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>
        Failed to load
      </h1>
      <p style={{ color: 'var(--fg-muted)', maxWidth: 500, textAlign: 'center' }}>
        {message}
      </p>
    </div>
  );
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
  const [theme, setTheme] = useTheme();
  const currentNodeId = useCurrentNodeId();
  const isGraph = useIsGraphRoute();

  useKeyboardNav(
    state.status === 'ready' ? state.graph : null,
    setTheme,
  );

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error} />;

  const { graph, config } = state;

  return (
    <>
      <div style={{ paddingBottom: isGraph ? 0 : 180 }}>
        <Routes>
          <Route path="/" element={
            <div style={{ padding: '2rem' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                {config.title}
              </h1>
              {config.subtitle && (
                <p style={{ color: 'var(--fg-muted)', marginBottom: '2rem' }}>
                  {config.subtitle}
                </p>
              )}
              <p style={{ color: 'var(--fg-muted)' }}>
                {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.clusters.length} clusters
              </p>
              <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {graph.nodes.slice(0, 20).map(node => (
                  <a
                    key={node.id}
                    href={`#/node/${encodeURIComponent(node.id)}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px', border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{node.emoji ?? '📌'}</span>
                    <span>{node.title}</span>
                    <span style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginLeft: 'auto' }}>
                      {node.cluster}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          } />
          <Route path="/graph" element={
            <div style={{ padding: '2rem' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)' }}>Constellation</h1>
              <p style={{ color: 'var(--fg-muted)' }}>Graph view — coming next</p>
            </div>
          } />
          <Route path="/node/:id" element={
            <div style={{ padding: '2rem' }}>
              <p style={{ color: 'var(--fg-muted)' }}>Reading view — coming next</p>
            </div>
          } />
        </Routes>
      </div>
      {!isGraph && (
        <HUD
          graph={graph}
          config={config}
          currentNodeId={currentNodeId}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
    </>
  );
}

function App() {
  return (
    <HashRouter>
      <Explorer />
    </HashRouter>
  );
}

export default App;

