import { HashRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<div>Overview</div>} />
        <Route path="/graph" element={<div>Graph</div>} />
        <Route path="/node/:id" element={<div>Reading</div>} />
      </Routes>
    </HashRouter>
  );
}

export default App;

