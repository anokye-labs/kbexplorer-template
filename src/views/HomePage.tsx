/**
 * HomePage — curated landing experience for kbexplorer.
 *
 * An editorial, observatory-style introduction that showcases the
 * knowledge graph before diving into individual nodes.
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  makeStyles,
  tokens,
  Title1,
  Title2,
  Subtitle1,
  Body1,
  Caption1,
  Card,
  CardHeader,
  Body1Strong,
  Button,
  Badge,
} from '@fluentui/react-components'
import {
  MapRegular,
  GridRegular,
  ArrowRightRegular,
  GlobeRegular,
  BranchForkRegular,
  DocumentRegular,
  CodeRegular,
  SparkleRegular,
} from '@fluentui/react-icons'
import type { KBGraph, KBConfig, KBNode, Cluster } from '../types'
import { NodeVisual } from '../components/NodeVisual'
import { createGraphNetwork } from '../engine/createGraphNetwork'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    overflowY: 'auto',
    color: tokens.colorNeutralForeground1,
  },

  // Hero section
  hero: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    maxHeight: '50vh',
    textAlign: 'center',
    overflow: 'hidden',
    paddingTop: '3rem',
    paddingBottom: '2rem',
  },
  heroCanvas: {
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
    pointerEvents: 'none',
  },
  heroContent: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '65ch',
    padding: '0 5vw',
  },
  heroTitle: {
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    marginBottom: '0.75rem',
    marginTop: 0,
  },
  heroSub: {
    fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)',
    lineHeight: 1.5,
    opacity: 0.75,
    marginBottom: '1.5rem',
    maxWidth: '50ch',
  },
  heroCta: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  heroGlow: {
    position: 'absolute',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    filter: 'blur(120px)',
    opacity: 0.12,
    pointerEvents: 'none',
    zIndex: 0,
  },

  // Stats ribbon
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2.5rem',
    padding: '1.5rem 5vw',
    flexWrap: 'wrap',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  stat: {
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: '0.2rem',
  },
  statLabel: {
    fontSize: '0.8rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    opacity: 0.5,
  },

  // Sections
  section: {
    maxWidth: '80rem',
    margin: '0 auto',
    padding: '2.5rem 5vw',
  },
  sectionTitle: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 600,
    marginBottom: '0.5rem',
    marginTop: 0,
    display: 'block',
  },
  sectionSub: {
    opacity: 0.6,
    marginBottom: '2rem',
    maxWidth: '55ch',
    marginTop: 0,
    display: 'block',
  },

  // Curated picks
  picksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  pickCard: {
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8,
    },
  },
  pickTitle: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // Cluster showcase
  clusterRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '2rem',
  },
  clusterChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1.25rem',
    borderRadius: '2rem',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      borderColor: tokens.colorNeutralForeground3,
    },
  },
  clusterDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },

  // Provider showcase
  providerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.5rem',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: '1rem',
  },
  providerIcon: {
    fontSize: '2rem',
    opacity: 0.7,
  },

  // Footer
  footer: {
    textAlign: 'center',
    padding: '3rem 5vw',
    opacity: 0.4,
    fontSize: '0.85rem',
  },
})

function NodeCard({ node, config, onClick }: { node: KBNode; config: KBConfig; onClick: () => void }) {
  const styles = useStyles()
  const cluster = config.clusters[node.cluster]
  const excerpt = node.rawContent?.replace(/^#.*\n/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim().slice(0, 120)

  return (
    <Card
      appearance="filled-alternative"
      className={styles.pickCard}
      onClick={onClick}
    >
      <CardHeader
        image={
          <NodeVisual
            node={node}
            mode={config.visuals.mode}
            surface="card"
            source={config.source}
          />
        }
        header={<Body1Strong className={styles.pickTitle}>{node.title}</Body1Strong>}
        description={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {cluster && (
              <Badge
                appearance="tint"
                size="small"
                style={{ background: cluster.color + '22', color: cluster.color }}
              >
                {cluster.name}
              </Badge>
            )}
          </div>
        }
      />
      {excerpt && (
        <Caption1 style={{ opacity: 0.6, display: 'block', padding: '0 12px 12px' }}>
          {excerpt}…
        </Caption1>
      )}
    </Card>
  )
}

/** Pick curated nodes: content-first, cluster-diverse, external included */
function getCuratedNodes(graph: KBGraph): KBNode[] {
  const picked = new Set<string>()
  const result: KBNode[] = []

  // Filter to curate-worthy nodes (authored content, derived, external — not raw files/dirs/issues/PRs)
  const curatable = graph.nodes.filter(n => {
    if (n.source.type === 'file') return false
    if (n.source.type === 'issue' || n.source.type === 'pull_request' || n.source.type === 'commit') return false
    if (n.id === 'readme' || n.id === 'repo-root' || n.id === 'commits') return false
    if (n.source.type === 'section') return false
    return true
  })

  // Group by cluster
  const byCluster = new Map<string, KBNode[]>()
  for (const n of curatable) {
    if (n.source.type === 'external') continue // handled separately
    const list = byCluster.get(n.cluster) ?? []
    list.push(n)
    byCluster.set(n.cluster, list)
  }

  // Degree map
  const degree = new Map<string, number>()
  for (const n of graph.nodes) degree.set(n.id, 0)
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }

  // Pick top 2 from each cluster
  for (const [, nodes] of byCluster) {
    const sorted = nodes.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    for (const n of sorted.slice(0, 2)) {
      if (!picked.has(n.id)) {
        picked.add(n.id)
        result.push(n)
      }
    }
  }

  // Ensure external nodes are included
  for (const n of graph.nodes) {
    if (n.source.type === 'external' && !picked.has(n.id)) {
      picked.add(n.id)
      result.push(n)
    }
  }

  return result.slice(0, 24)
}

export interface HomePageProps {
  graph: KBGraph
  config: KBConfig
}

export function HomePage({ graph, config }: HomePageProps) {
  const styles = useStyles()
  const heroCanvasRef = useRef<HTMLDivElement>(null)
  const [curatedNodes] = useState(() => getCuratedNodes(graph))

  // Find the home node for its narrative prose
  const homeNode = graph.nodes.find(n => n.id === 'home')
  const nodeIds = new Set(graph.nodes.map(n => n.id))

  // Linkify home node content — convert [text](node-id) to hash links
  const linkedContent = homeNode ? homeNode.content.replace(
    /<a href="([^"#/][^"]*)">/g,
    (_match: string, target: string) => {
      if (nodeIds.has(target)) return `<a href="#/node/${encodeURIComponent(target)}">`
      return `<a href="${target}">`
    }
  ) : ''

  // Cluster stats
  const clusterCounts = new Map<string, number>()
  for (const n of graph.nodes) {
    clusterCounts.set(n.cluster, (clusterCounts.get(n.cluster) ?? 0) + 1)
  }
  const activeClusters = graph.clusters.filter(c => clusterCounts.has(c.id))

  const externalCount = graph.nodes.filter(n => n.source.type === 'external').length
  const contentCount = graph.nodes.filter(n =>
    n.source.type === 'authored' || n.source.type === 'derived' || n.source.type === 'readme'
  ).length
  const workCount = graph.nodes.filter(n =>
    n.source.type === 'issue' || n.source.type === 'pull_request'
  ).length

  // Mini hero graph
  useEffect(() => {
    if (!heroCanvasRef.current) return
    const { network } = createGraphNetwork({
      container: heroCanvasRef.current,
      graph,
      isDark: true,
      interactive: false,
      fitOnStabilize: true,
      nodeSizeRange: [12, 24],
      nodeSizeStep: 2,
      labelMaxLength: 0,
    })
    network.once('stabilized', () => {
      network.setOptions({ physics: { enabled: false } })
      network.fit({ animation: false })
    })
    return () => { try { network.destroy() } catch { /* */ } }
  }, [graph])

  const navigate = (hash: string) => { window.location.hash = hash }

  // Split curated into external vs internal
  const externalPicks = curatedNodes.filter(n => n.source.type === 'external')
  const internalPicks = curatedNodes.filter(n => n.source.type !== 'external')

  return (
    <div className={styles.root}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} style={{ background: '#4A9CC8', top: '-20%', left: '-10%' }} />
        <div className={styles.heroGlow} style={{ background: '#E8A838', bottom: '-20%', right: '-10%' }} />
        <div ref={heroCanvasRef} className={styles.heroCanvas} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{config.title}</h1>
          <p className={styles.heroSub}>
            {config.subtitle ?? 'Turn any repository into a navigable knowledge constellation — explore code, issues, docs, and external references as an interconnected graph.'}
          </p>
          <div className={styles.heroCta}>
            <Button
              appearance="primary"
              size="large"
              icon={<MapRegular />}
              onClick={() => navigate('#/node/readme')}
            >
              Explore the Graph
            </Button>
            <Button
              appearance="outline"
              size="large"
              icon={<GridRegular />}
              onClick={() => navigate('#/overview')}
            >
              Browse All Nodes
            </Button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
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
        <div className={styles.stat}>
          <div className={styles.statNumber}>{externalCount}</div>
          <div className={styles.statLabel}>External Sources</div>
        </div>
      </div>

      {/* ── Narrative Prose ── */}
      {linkedContent && (
        <section className={styles.section}>
          <div className="kb-prose" style={{ maxWidth: '70ch' }} dangerouslySetInnerHTML={{ __html: linkedContent }} />
        </section>
      )}

      {/* ── Clusters ── */}
      <section className={styles.section}>
        <Title2 className={styles.sectionTitle}>Knowledge Clusters</Title2>
        <Body1 className={styles.sectionSub}>
          The graph is organized into thematic clusters — each a constellation of related concepts.
        </Body1>
        <div className={styles.clusterRow}>
          {activeClusters.map(c => (
            <div
              key={c.id}
              className={styles.clusterChip}
              onClick={() => navigate('#/overview')}
            >
              <span className={styles.clusterDot} style={{ background: c.color }} />
              <Body1Strong>{c.name}</Body1Strong>
              <Caption1 style={{ opacity: 0.5 }}>{clusterCounts.get(c.id) ?? 0}</Caption1>
            </div>
          ))}
        </div>
      </section>

      {/* ── Curated Picks ── */}
      <section className={styles.section}>
        <Title2 className={styles.sectionTitle}>Start Exploring</Title2>
        <Body1 className={styles.sectionSub}>
          Curated entry points into the knowledge graph — the most connected and most important nodes.
        </Body1>
        <div className={styles.picksGrid}>
          {internalPicks.slice(0, 12).map(n => (
            <NodeCard
              key={n.id}
              node={n}
              config={config}
              onClick={() => navigate(`#/node/${encodeURIComponent(n.id)}`)}
            />
          ))}
        </div>
      </section>

      {/* ── Data Sources ── */}
      <section className={styles.section}>
        <Title2 className={styles.sectionTitle}>Data Sources</Title2>
        <Body1 className={styles.sectionSub}>
          kbexplorer synthesizes knowledge from multiple sources into a single navigable graph.
        </Body1>

        <div className={styles.providerCard}>
          <CodeRegular className={styles.providerIcon} />
          <div>
            <Body1Strong>Source Code</Body1Strong>
            <Caption1 style={{ display: 'block', opacity: 0.6 }}>
              Repository structure, modules, and file dependencies
            </Caption1>
          </div>
          <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>
            {graph.nodes.filter(n => n.source.type === 'file').length} nodes
          </Caption1>
        </div>

        <div className={styles.providerCard}>
          <DocumentRegular className={styles.providerIcon} />
          <div>
            <Body1Strong>Documentation</Body1Strong>
            <Caption1 style={{ display: 'block', opacity: 0.6 }}>
              Authored content, README, and derived knowledge
            </Caption1>
          </div>
          <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>
            {contentCount} nodes
          </Caption1>
        </div>

        <div className={styles.providerCard}>
          <BranchForkRegular className={styles.providerIcon} />
          <div>
            <Body1Strong>Work Items</Body1Strong>
            <Caption1 style={{ display: 'block', opacity: 0.6 }}>
              Issues, pull requests, and commit history
            </Caption1>
          </div>
          <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>
            {workCount} nodes
          </Caption1>
        </div>

        {externalCount > 0 && (
          <div className={styles.providerCard}>
            <GlobeRegular className={styles.providerIcon} />
            <div>
              <Body1Strong>External References</Body1Strong>
              <Caption1 style={{ display: 'block', opacity: 0.6 }}>
                Wikipedia articles and external knowledge sources
              </Caption1>
            </div>
            <Caption1 style={{ marginLeft: 'auto', opacity: 0.5 }}>
              {externalCount} nodes
            </Caption1>
          </div>
        )}
      </section>

      {/* ── External References ── */}
      {externalPicks.length > 0 && (
        <section className={styles.section}>
          <Title2 className={styles.sectionTitle}>
            <GlobeRegular style={{ marginRight: 8 }} />
            External References
          </Title2>
          <Body1 className={styles.sectionSub}>
            Wikipedia articles and external knowledge linked to the project's core concepts.
          </Body1>
          <div className={styles.picksGrid}>
            {externalPicks.map(n => (
              <NodeCard
                key={n.id}
                node={n}
                config={config}
                onClick={() => navigate(`#/node/${encodeURIComponent(n.id)}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Capabilities ── */}
      <section className={styles.section}>
        <Title2 className={styles.sectionTitle}>How It Works</Title2>
        <Body1 className={styles.sectionSub}>
          kbexplorer presents knowledge through multiple complementary views.
        </Body1>

        <div className={styles.picksGrid}>
          <Card appearance="filled-alternative" style={{ padding: '1.5rem' }}>
            <SparkleRegular style={{ fontSize: '1.5rem', marginBottom: 8 }} />
            <Body1Strong style={{ display: 'block', marginBottom: 4 }}>Constellation Graph</Body1Strong>
            <Caption1 style={{ opacity: 0.6 }}>
              Force-directed visualization with multi-tier edge importance, cluster coloring, and dynamic detail control from 1 to 100 nodes.
            </Caption1>
          </Card>
          <Card appearance="filled-alternative" style={{ padding: '1.5rem' }}>
            <DocumentRegular style={{ fontSize: '1.5rem', marginBottom: 8 }} />
            <Body1Strong style={{ display: 'block', marginBottom: 4 }}>Reading View</Body1Strong>
            <Caption1 style={{ opacity: 0.6 }}>
              Deep-dive into individual nodes with inline-linked prose, code citations, and related nodes panel.
            </Caption1>
          </Card>
          <Card appearance="filled-alternative" style={{ padding: '1.5rem' }}>
            <GridRegular style={{ fontSize: '1.5rem', marginBottom: 8 }} />
            <Body1Strong style={{ display: 'block', marginBottom: 4 }}>Card Overview</Body1Strong>
            <Caption1 style={{ opacity: 0.6 }}>
              Browse all nodes as cards grouped by cluster — scan the full knowledge base at a glance.
            </Caption1>
          </Card>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        <Caption1>
          Built with kbexplorer · {graph.nodes.length} nodes · {graph.edges.length} edges · {activeClusters.length} clusters
        </Caption1>
      </div>
    </div>
  )
}
