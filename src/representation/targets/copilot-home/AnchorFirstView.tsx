/**
 * Anchor-first home view (B2 #408, epic #407 / #401).
 *
 * The bespoke `copilot` surface's landing view — NOT the constellation. It
 * renders the conversation's anchor node (via its existing node-type viewer from
 * the open viewer registry — REUSED, never rebuilt), then that anchor's
 * weight-ranked neighbors: the top-ranked ones EXPANDED inline, and the
 * relevant-but-unexpanded remainder as navigable `kg://` chips that re-anchor
 * the view on click (`#/node/<id>`). The force-directed constellation becomes an
 * optional zoom-out affordance, not the landing.
 *
 * Ranking + expansion are NOT reimplemented here: {@link expandAnchoredNeighborhood}
 * is the same greedy partition (over the engine's `graph.related` edge-weight
 * order) that `llm-context` uses — the view supplies a unit cost + a
 * max-expanded count instead of a token budget/cost.
 *
 * NO-ANCHOR FALLBACK: when the anchor id is absent from the graph (including the
 * no-anchor `/node/home` config landing), the constellation ({@link HomePage})
 * renders as the sensible default.
 *
 * THEME: inherit-host is already wired by the embeddable mount
 * (`useCanvasTheme`); this view consumes Fluent tokens only and never re-mirrors
 * host vars.
 */
import { createElement, useMemo } from 'react';
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Divider,
  Subtitle2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowExpandRegular } from '@fluentui/react-icons';
import { stripScheme } from '@anokye-labs/kbexplorer-core';
import type { KBConfig, KBEdge, KBGraph } from '../../../types';
import { resolveViewer } from '../../../views/viewers';
import { HomePage } from '../../../views/HomePage';
import { nodeUrn } from '../urn';
import { expandAnchoredNeighborhood, type AnchoredNeighbor } from '../llm-context';

/** Default number of top-ranked neighbors rendered inline (rest → chips). */
export const DEFAULT_MAX_EXPANDED = 6;

/** Relation label for a neighbor edge: explicit relation, else structural type. */
function relationLabel(edge: KBEdge | undefined): string {
  return edge?.relation ?? edge?.type ?? 'related';
}

function weightLabel(edge: KBEdge | undefined): string {
  return (edge?.weight ?? 0).toFixed(2);
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
    width: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  headerTitle: {
    // Narrow-column invariant (#412): a long anchor title wraps instead of
    // pushing the constellation button out / forcing horizontal scroll.
    minWidth: 0,
    flex: '1 1 auto',
    overflowWrap: 'anywhere',
  },
  anchorBadges: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  anchorBody: {
    display: 'block',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  sectionTitle: {
    color: tokens.colorNeutralForeground3,
  },
  neighborCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  neighborHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  neighborTitle: {
    // Same narrow-column wrapping invariant as the anchor header (#412).
    minWidth: 0,
    flex: '1 1 auto',
    overflowWrap: 'anywhere',
  },
  neighborMeta: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  chip: {
    minWidth: 0,
    justifyContent: 'flex-start',
    height: 'auto',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  urn: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

/** A single expanded neighbor: header (title · relation · weight) + its viewer. */
function ExpandedNeighbor({ neighbor }: { neighbor: AnchoredNeighbor }) {
  const styles = useStyles();
  const { node, edge } = neighbor;
  return (
    <Card
      appearance="subtle"
      size="small"
      className={styles.neighborCard}
      data-testid="anchor-expanded-neighbor"
      data-node-id={node.id}
    >
      <a
        href={`#/node/${encodeURIComponent(node.id)}`}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div className={styles.neighborHead}>
          <Subtitle2 className={styles.neighborTitle}>{node.title}</Subtitle2>
          <Caption1 className={styles.neighborMeta}>
            {relationLabel(edge)} · {weightLabel(edge)}
          </Caption1>
        </div>
      </a>
      {createElement(resolveViewer(node), { node })}
    </Card>
  );
}

/** A `kg://` chip for a relevant-but-unexpanded neighbor — navigates on click. */
function NeighborChip({ neighbor }: { neighbor: AnchoredNeighbor }) {
  const styles = useStyles();
  const { node, edge } = neighbor;
  const urn = nodeUrn(node);
  return (
    <Button
      as="a"
      href={`#/node/${encodeURIComponent(node.id)}`}
      appearance="outline"
      size="small"
      className={styles.chip}
      title={`${stripScheme(urn)} · ${relationLabel(edge)} · weight ${weightLabel(edge)}`}
      data-testid="anchor-neighbor-chip"
      data-node-id={node.id}
    >
      {node.title}
    </Button>
  );
}

export interface AnchorFirstViewProps {
  graph: KBGraph;
  config: KBConfig;
  /** The conversation anchor node id (from `bootConfig.anchorNodeId`). */
  anchorId: string;
  /** Max top-ranked neighbors rendered inline; the rest become `kg://` chips. */
  maxExpanded?: number;
}

/**
 * Render the anchor-first home for a single anchor node. Falls back to the
 * constellation when the anchor id is not a node in the graph.
 */
export function AnchorFirstView({
  graph,
  config,
  anchorId,
  maxExpanded = DEFAULT_MAX_EXPANDED,
}: AnchorFirstViewProps) {
  const styles = useStyles();

  // Memoize the anchor lookup + shared greedy partition (llm-context) so theme
  // changes / parent re-renders don't re-run the O(n) walk. Unit cost + a count
  // budget expand the top `maxExpanded` ranked neighbors; the rest link out.
  // Computed before any early return so hook order stays stable.
  const { anchor, expanded, unexpanded } = useMemo(() => {
    const anchorNode = graph.nodes.find(n => n.id === anchorId);
    if (!anchorNode) {
      return { anchor: undefined, expanded: [], unexpanded: [] };
    }
    const partition = expandAnchoredNeighborhood(graph, [anchorId], () => 1, maxExpanded);
    return { anchor: anchorNode, expanded: partition.expanded, unexpanded: partition.unexpanded };
  }, [graph, anchorId, maxExpanded]);

  // NO-ANCHOR / bad-anchor fallback: the constellation is the sensible default.
  if (!anchor) {
    return (
      <div className={styles.root} data-testid="anchor-first-fallback">
        <Caption1 className={styles.sectionTitle}>
          No conversation anchor — showing the full map.
        </Caption1>
        <HomePage graph={graph} config={config} />
      </div>
    );
  }

  const cluster = config.clusters?.[anchor.cluster];

  return (
    <div className={styles.root} data-testid="anchor-first-view" data-anchor-id={anchor.id}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <Title3 className={styles.headerTitle}>{anchor.title}</Title3>
          <Button
            as="a"
            href="#/constellation"
            appearance="subtle"
            size="small"
            icon={<ArrowExpandRegular />}
            data-testid="constellation-zoom-out"
          >
            Constellation
          </Button>
        </div>
        <div className={styles.anchorBadges}>
          <Badge appearance="tint" color="brand">
            Anchor
          </Badge>
          {cluster?.name && (
            <Badge appearance="tint" color="informative">
              {cluster.name}
            </Badge>
          )}
          <code className={styles.urn}>{stripScheme(nodeUrn(anchor))}</code>
        </div>
      </div>

      <div className={styles.anchorBody}>
        {createElement(resolveViewer(anchor), { node: anchor })}
      </div>

      {expanded.length > 0 && (
        <>
          <Divider />
          <div className={styles.section} data-testid="anchor-expanded-neighbors">
            <Body1 className={styles.sectionTitle}>Nearest neighbors</Body1>
            {expanded.map(neighbor => (
              <ExpandedNeighbor key={neighbor.node.id} neighbor={neighbor} />
            ))}
          </div>
        </>
      )}

      {unexpanded.length > 0 && (
        <div className={styles.section} data-testid="anchor-neighbor-chips">
          <Body1 className={styles.sectionTitle}>Navigate — follow a link for more</Body1>
          <div className={styles.chips}>
            {unexpanded.map(neighbor => (
              <NeighborChip key={neighbor.node.id} neighbor={neighbor} />
            ))}
          </div>
        </div>
      )}

      {expanded.length === 0 && unexpanded.length === 0 && (
        <Caption1 className={styles.sectionTitle} data-testid="anchor-no-neighbors">
          This node has no ranked neighbors yet.
        </Caption1>
      )}
    </div>
  );
}
