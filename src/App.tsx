import { HashRouter, Routes, Route } from 'react-router-dom';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import GraphView from './views/GraphView';
import { OverviewView } from './views/OverviewView';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import './styles/visuals.css';
import './styles/overview.css';

function Explorer() {
  const state = useKnowledgeBase();

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error} />;

  const { graph, config } = state;

  return (
    <Routes>
      <Route path="/" element={<OverviewView graph={graph} config={config} />} />
      <Route path="/graph" element={
        <GraphView graph={graph} config={config} />
      } />
      <Route path="/node/:id" element={
        <div style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--fg-muted)' }}>Reading view — coming next</p>
        </div>
      } />
    </Routes>
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

