import { HashRouter, Routes, Route, useParams } from 'react-router-dom';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { ReadingView } from './views/ReadingView';
import GraphView from './views/GraphView';
import { OverviewView } from './views/OverviewView';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import './styles/visuals.css';
import './styles/overview.css';
import './styles/reading.css';

function ReadingRoute({ graph, config }: { graph: import('./types').KBGraph; config: import('./types').KBConfig }) {
  const { id } = useParams<{ id: string }>();
  return <ReadingView graph={graph} config={config} nodeId={id ?? ''} />;
}

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
      <Route path="/node/:id" element={<ReadingRoute graph={graph} config={config} />} />
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

