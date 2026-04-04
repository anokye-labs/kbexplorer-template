export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__spinner" />
      <p className="loading-screen__text">Loading knowledge base…</p>
      <div className="loading-screen__skeletons">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="loading-screen__skeleton" />
        ))}
      </div>
    </div>
  );
}
