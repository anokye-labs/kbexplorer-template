import type { KBGraph, KBConfig, KBNode, Cluster } from '../types';
import { NodeVisual } from '../components/NodeVisual';

interface ReadingViewProps {
  graph: KBGraph;
  config: KBConfig;
  nodeId: string;
}

function findCluster(config: KBConfig, clusters: Cluster[], clusterId: string) {
  const meta = config.clusters[clusterId];
  const cluster = clusters.find(c => c.id === clusterId);
  return {
    name: meta?.name ?? cluster?.name ?? clusterId,
    color: meta?.color ?? cluster?.color ?? '#888',
  };
}

function getClusterNodes(nodes: KBNode[], clusterId: string): KBNode[] {
  return nodes
    .filter(n => n.cluster === clusterId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function ReadingView({ graph, config, nodeId }: ReadingViewProps) {
  const node = graph.nodes.find(n => n.id === nodeId);

  if (!node) {
    return (
      <div className="kb-reading-notfound">
        <span style={{ fontSize: 48 }}>🔍</span>
        <h1>Node not found</h1>
        <p style={{ color: 'var(--fg-muted)' }}>
          No node with id "{nodeId}" exists in this knowledge base.
        </p>
        <a href="#/" className="kb-reading-back">← Back to overview</a>
      </div>
    );
  }

  const mode = config.visuals.mode;
  const source = config.source;
  const cluster = findCluster(config, graph.clusters, node.cluster);

  // Connected nodes
  const relatedIds = graph.related[nodeId] ?? [];
  const connectionMap = new Map(
    node.connections.map(c => [c.to, c.description])
  );
  const connectedNodes = relatedIds
    .map(id => graph.nodes.find(n => n.id === id))
    .filter((n): n is KBNode => n != null);

  // Prev/next within cluster
  const clusterNodes = getClusterNodes(graph.nodes, node.cluster);
  const idx = clusterNodes.findIndex(n => n.id === nodeId);
  const prev = idx > 0 ? clusterNodes[idx - 1] : null;
  const next = idx < clusterNodes.length - 1 ? clusterNodes[idx + 1] : null;

  const showHero = mode === 'heroes' && !!node.image;

  return (
    <div className="kb-reading">
      {/* Hero image */}
      {showHero && (
        <NodeVisual node={node} mode={mode} surface="hero" source={source} />
      )}

      {/* Back link */}
      <a href="#/" className="kb-reading-back">← Back to overview</a>

      {/* Header */}
      <header className={`kb-reading-header ${showHero ? 'kb-reading-header--hero' : ''}`}>
        <div className="kb-reading-header__visual">
          {!showHero && (mode === 'sprites' && node.sprite) && (
            <NodeVisual node={node} mode={mode} surface="header" source={source} />
          )}
          {!showHero && mode === 'emoji' && node.emoji && (
            <NodeVisual node={node} mode="emoji" surface="header" source={source} />
          )}
        </div>
        <div className="kb-reading-cluster">
          <span
            className="kb-reading-cluster__dot"
            style={{ background: cluster.color }}
          />
          {cluster.name}
        </div>
        <h1 className="kb-reading-title">{node.title}</h1>
      </header>

      {/* Body: prose + connections */}
      <div className="kb-reading-body">
        <div
          className="kb-prose"
          dangerouslySetInnerHTML={{ __html: node.content }}
        />

        {connectedNodes.length > 0 && (
          <aside className="kb-connections">
            <h2 className="kb-connections__title">
              Connected
              <span className="kb-connections__count">{connectedNodes.length}</span>
            </h2>
            <div className="kb-connections__list">
              {connectedNodes.map(cn => {
                const cnCluster = findCluster(config, graph.clusters, cn.cluster);
                const desc = connectionMap.get(cn.id) ?? '';
                return (
                  <a
                    key={cn.id}
                    href={`#/node/${encodeURIComponent(cn.id)}`}
                    className="kb-connection-card"
                  >
                    <NodeVisual
                      node={cn}
                      mode={mode}
                      surface="connection"
                      source={source}
                    />
                    <div className="kb-connection-card__info">
                      <span className="kb-connection-card__title">{cn.title}</span>
                      {desc && (
                        <span className="kb-connection-card__desc">{desc}</span>
                      )}
                    </div>
                    <span className="kb-connection-pill">
                      <span
                        className="kb-connection-pill__dot"
                        style={{ background: cnCluster.color }}
                      />
                      {cnCluster.name}
                    </span>
                  </a>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Prev / Next */}
      <nav className="kb-nav-footer">
        <a
          href={prev ? `#/node/${encodeURIComponent(prev.id)}` : undefined}
          className={`kb-nav-footer__link ${!prev ? 'kb-nav-footer__link--disabled' : ''}`}
          aria-disabled={!prev}
        >
          <span className="kb-nav-footer__label">← Previous</span>
          <span className="kb-nav-footer__title">
            {prev?.emoji && <span>{prev.emoji}</span>}
            {prev?.title ?? '—'}
          </span>
          <span className="kb-nav-footer__cluster">{cluster.name}</span>
        </a>
        <a
          href={next ? `#/node/${encodeURIComponent(next.id)}` : undefined}
          className={`kb-nav-footer__link kb-nav-footer__link--next ${!next ? 'kb-nav-footer__link--disabled' : ''}`}
          aria-disabled={!next}
        >
          <span className="kb-nav-footer__label">Next →</span>
          <span className="kb-nav-footer__title">
            {next?.emoji && <span>{next.emoji}</span>}
            {next?.title ?? '—'}
          </span>
          <span className="kb-nav-footer__cluster">{cluster.name}</span>
        </a>
      </nav>
    </div>
  );
}
