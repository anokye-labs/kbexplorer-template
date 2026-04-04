import type { KBGraph, KBConfig, KBNode, Cluster } from '../types';
import { NodeVisual } from '../components/NodeVisual';

export interface OverviewViewProps {
  graph: KBGraph;
  config: KBConfig;
}

/** Group nodes by cluster id, preserving cluster ordering. */
function groupByCluster(
  nodes: KBNode[],
  clusters: Cluster[]
): { cluster: Cluster; nodes: KBNode[] }[] {
  const map = new Map<string, KBNode[]>();
  for (const node of nodes) {
    const list = map.get(node.cluster) ?? [];
    list.push(node);
    map.set(node.cluster, list);
  }
  return clusters
    .filter(c => map.has(c.id))
    .map(cluster => ({ cluster, nodes: map.get(cluster.id)! }));
}

export function OverviewView({ graph, config }: OverviewViewProps) {
  const groups = groupByCluster(graph.nodes, graph.clusters);

  return (
    <div className="overview">
      <h1 className="overview__title">{config.title}</h1>
      {config.subtitle && (
        <p className="overview__subtitle">{config.subtitle}</p>
      )}
      <p className="overview__stats">
        {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.clusters.length} clusters
      </p>

      {groups.map(({ cluster, nodes }) => (
        <section key={cluster.id} className="overview__cluster">
          <h2 className="overview__cluster-header">
            <span
              className="overview__cluster-dot"
              style={{ background: cluster.color }}
            />
            {cluster.name}
          </h2>

          <div className="overview__grid">
            {nodes.map(node => (
              <a
                key={node.id}
                href={`#/node/${encodeURIComponent(node.id)}`}
                className="overview__card"
                style={{
                  ['--cluster-glow' as string]: cluster.color,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = cluster.color + '66';
                  el.style.boxShadow = `0 4px 20px ${cluster.color}22`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = '';
                  el.style.boxShadow = '';
                }}
              >
                <NodeVisual
                  node={node}
                  mode={config.visuals.mode}
                  surface="card"
                  source={config.source}
                />
                <div className="overview__card-body">
                  <span className="overview__card-title">{node.title}</span>
                  <span className="overview__card-meta">
                    <span className="overview__card-connections">
                      {node.connections.length} connection{node.connections.length !== 1 ? 's' : ''}
                    </span>
                    <span
                      className="overview__card-pill"
                      style={{ borderColor: cluster.color + '44' }}
                    >
                      {cluster.name}
                    </span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
