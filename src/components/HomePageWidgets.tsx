/**
 * HomePageWidgets — stats, clusters, curated picks, and data sources
 * rendered below the homepage narrative prose.
 */
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Body1Strong,
  Caption1,
  Card,
  CardHeader,
  Badge,
  Button,
} from '@fluentui/react-components'
import {
  GridRegular,
  GlobeRegular,
  BranchForkRegular,
  DocumentRegular,
  CodeRegular,
  SparkleRegular,
  MapRegular,
} from '@fluentui/react-icons'
import type { KBGraph, KBConfig, KBNode } from '../types'
import { NodeVisual } from './NodeVisual'

const useStyles = makeStyles({
  stats: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '2.5rem',
    padding: '1.5rem 0',
    flexWrap: 'wrap',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: '2rem',
  },
  stat: { textAlign: 'center' },
  statNumber: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.2rem' },
  statLabel: { fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.1em', opacity: 0.5 },

  section: { padding: '2rem 0' },
  sectionTitle: { fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', marginTop: 0, display: 'block' },
  sectionSub: { opacity: 0.6, marginBottom: '1.5rem', maxWidth: '55ch', marginTop: 0, display: 'block' },

  picksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '0.75rem',
  },
  pickCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow8 },
  },
  pickTitle: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  clusterRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  clusterChip: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.35rem 1rem', borderRadius: '2rem',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer', fontSize: '0.85rem',
    transition: 'all 0.2s',
    ':hover': { borderColor: tokens.colorNeutralForeground3 },
  },

  providerCard: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1rem', borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: '0.5rem',
  },
  providerIcon: { fontSize: '1.5rem', opacity: 0.7 },
})

function getCuratedNodes(graph: KBGraph): KBNode[] {
  const picked = new Set<string>()
  const result: KBNode[] = []

  const curatable = graph.nodes.filter(n => {
    if (n.source.type === 'file') return false
    if (n.source.type === 'issue' || n.source.type === 'pull_request' || n.source.type === 'commit') return false
    if (n.id === 'readme' || n.id === 'repo-root' || n.id === 'commits' || n.id === 'home') return false
    if (n.source.type === 'section') return false
    return true
  })

  const byCluster = new Map<string, KBNode[]>()
  for (const n of curatable) {
    if (n.source.type === 'external') continue
    const list = byCluster.get(n.cluster) ?? []
    list.push(n)
    byCluster.set(n.cluster, list)
  }

  const degree = new Map<string, number>()
  for (const n of graph.nodes) degree.set(n.id, 0)
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }

  for (const [, nodes] of byCluster) {
    const sorted = nodes.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    for (const n of sorted.slice(0, 2)) {
      if (!picked.has(n.id)) { picked.add(n.id); result.push(n) }
    }
  }

  for (const n of graph.nodes) {
    if (n.source.type === 'external' && !picked.has(n.id)) { picked.add(n.id); result.push(n) }
  }

  return result.slice(0, 24)
}

export function HomePageWidgets({ graph, config }: { graph: KBGraph; config: KBConfig }) {
  const styles = useStyles()
  const curatedNodes = getCuratedNodes(graph)

  const clusterCounts = new Map<string, number>()
  for (const n of graph.nodes) clusterCounts.set(n.cluster, (clusterCounts.get(n.cluster) ?? 0) + 1)
  const activeClusters = graph.clusters.filter(c => clusterCounts.has(c.id))

  const externalCount = graph.nodes.filter(n => n.source.type === 'external').length
  const contentCount = graph.nodes.filter(n =>
    n.source.type === 'authored' || n.source.type === 'derived' || n.source.type === 'readme'
  ).length
  const workCount = graph.nodes.filter(n =>
    n.source.type === 'issue' || n.source.type === 'pull_request'
  ).length

  const navigate = (hash: string) => { window.location.hash = hash }
  const internalPicks = curatedNodes.filter(n => n.source.type !== 'external')
  const externalPicks = curatedNodes.filter(n => n.source.type === 'external')

  return (
    <>
      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNumber}>{graph.nodes.length}</div>
          <div className={styles.statLabel}>Nodes</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>{graph.edges.length}</div>
          <div className={styles.statLabel}>Connections</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>{activeClusters.length}</div>
          <div className={styles.statLabel}>Clusters</div>
        </div>
        {externalCount > 0 && (
          <div className={styles.stat}>
            <div className={styles.statNumber}>{externalCount}</div>
            <div className={styles.statLabel}>External</div>
          </div>
        )}
      </div>

      {/* Clusters */}
      <div className={styles.section}>
        <div className={styles.clusterRow}>
          {activeClusters.map(c => (
            <div key={c.id} className={styles.clusterChip} onClick={() => navigate('#/overview')}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <Body1Strong>{c.name}</Body1Strong>
              <Caption1 style={{ opacity: 0.5 }}>{clusterCounts.get(c.id) ?? 0}</Caption1>
            </div>
          ))}
        </div>
      </div>

      {/* Curated Picks */}
      <div className={styles.section}>
        <Title2 className={styles.sectionTitle}>Start Exploring</Title2>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <Button appearance="primary" size="medium" icon={<MapRegular />} onClick={() => navigate('#/node/readme')}>
            Constellation
          </Button>
          <Button appearance="outline" size="medium" icon={<GridRegular />} onClick={() => navigate('#/overview')}>
            All Nodes
          </Button>
        </div>
        <div className={styles.picksGrid}>
          {internalPicks.slice(0, 9).map(n => {
            const cluster = config.clusters[n.cluster]
            const excerpt = n.rawContent?.replace(/^#.*\n/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim().slice(0, 100)
            return (
              <Card key={n.id} appearance="filled-alternative" className={styles.pickCard}
                onClick={() => navigate(`#/node/${encodeURIComponent(n.id)}`)}>
                <CardHeader
                  image={<NodeVisual node={n} mode={config.visuals.mode} surface="card" source={config.source} />}
                  header={<Body1Strong className={styles.pickTitle}>{n.title}</Body1Strong>}
                  description={cluster && (
                    <Badge appearance="tint" size="small" style={{ background: cluster.color + '22', color: cluster.color, marginTop: 4 }}>
                      {cluster.name}
                    </Badge>
                  )}
                />
                {excerpt && <Caption1 style={{ opacity: 0.6, display: 'block', padding: '0 12px 8px' }}>{excerpt}…</Caption1>}
              </Card>
            )
          })}
        </div>
      </div>

      {/* External References */}
      {externalPicks.length > 0 && (
        <div className={styles.section}>
          <Title2 className={styles.sectionTitle}>
            <GlobeRegular style={{ marginRight: 6 }} />
            External References
          </Title2>
          <div className={styles.picksGrid}>
            {externalPicks.slice(0, 9).map(n => {
              const excerpt = n.rawContent?.replace(/\[.*?\]\(.*?\)/g, '').trim().slice(0, 100)
              return (
                <Card key={n.id} appearance="filled-alternative" className={styles.pickCard}
                  onClick={() => navigate(`#/node/${encodeURIComponent(n.id)}`)}>
                  <CardHeader
                    image={<NodeVisual node={n} mode={config.visuals.mode} surface="card" source={config.source} />}
                    header={<Body1Strong className={styles.pickTitle}>{n.title}</Body1Strong>}
                    description={<Badge appearance="tint" size="small" style={{ background: '#79C0FF22', color: '#79C0FF', marginTop: 4 }}>Reference</Badge>}
                  />
                  {excerpt && <Caption1 style={{ opacity: 0.6, display: 'block', padding: '0 12px 8px' }}>{excerpt}…</Caption1>}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Data Sources */}
      <div className={styles.section}>
        <Title2 className={styles.sectionTitle}>Data Sources</Title2>
        <div className={styles.providerCard}>
          <CodeRegular className={styles.providerIcon} />
          <div><Body1Strong>Source Code</Body1Strong><Caption1 style={{ display: 'block', opacity: 0.6 }}>Repository files and modules</Caption1></div>
          <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>{graph.nodes.filter(n => n.source.type === 'file').length}</Caption1>
        </div>
        <div className={styles.providerCard}>
          <DocumentRegular className={styles.providerIcon} />
          <div><Body1Strong>Documentation</Body1Strong><Caption1 style={{ display: 'block', opacity: 0.6 }}>Authored and derived content</Caption1></div>
          <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>{contentCount}</Caption1>
        </div>
        <div className={styles.providerCard}>
          <BranchForkRegular className={styles.providerIcon} />
          <div><Body1Strong>Work Items</Body1Strong><Caption1 style={{ display: 'block', opacity: 0.6 }}>Issues and pull requests</Caption1></div>
          <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>{workCount}</Caption1>
        </div>
        {externalCount > 0 && (
          <div className={styles.providerCard}>
            <GlobeRegular className={styles.providerIcon} />
            <div><Body1Strong>External</Body1Strong><Caption1 style={{ display: 'block', opacity: 0.6 }}>Wikipedia and external sources</Caption1></div>
            <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>{externalCount}</Caption1>
          </div>
        )}
      </div>
    </>
  )
}
