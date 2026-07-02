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
 * AGENT VIEW-ACTIONS (#409, cli#214): an optional `viewAction` prop layers the
 * accumulated `expand`/`trace`/`filter` `/events` state on top of the ranked
 * partition — `expand` force-adds neighbors (and highlights a `focus` node),
 * `trace` renders a path banner and highlights matching nodes, `filter`
 * constrains which neighbors render. All are additive/no-op when absent, so
 * every existing caller (including tests) is unaffected.
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
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { ArrowExpandRegular } from '@fluentui/react-icons';
import { stripScheme } from '@anokye-labs/kbexplorer-core';
import type { KBConfig, KBEdge, KBGraph, KBNode } from '../../../types';
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

/** Agent view-actions layered onto the ranked partition (#409, cli#214). See module doc. */
export interface AnchorViewAction {
  /** Node ids force-added by `expand` (unioned across every `expand` seen — never cleared). */
  expandedNodeIds?: ReadonlySet<string>;
  /** The most recent `expand`'s focus node id. */
  focusNodeId?: string;
  /** The most recent `trace` result. */
  trace?: { path: string[]; connected: boolean };
  /** The active `filter`'s resolved node-id set (already client-resolved by the caller). */
  filterNodeIds?: ReadonlySet<string>;
}

/**
 * Force-add `expand`-named neighbors into `expanded`, promoting them out of
 * `unexpanded` when already ranked there, else synthesizing a card for a node
 * outside the anchor's ranked neighborhood entirely (best-effort direct edge,
 * possibly none — {@link ExpandedNeighbor} already tolerates an undefined edge).
 * Unknown ids (not in `graph` at all) degrade silently, never throw.
 */
function mergeForcedExpansion(
  graph: KBGraph,
  anchor: KBNode,
  expanded: AnchoredNeighbor[],
  unexpanded: AnchoredNeighbor[],
  forcedIds: ReadonlySet<string> | undefined,
): { expanded: AnchoredNeighbor[]; unexpanded: AnchoredNeighbor[] } {
  if (!forcedIds || forcedIds.size === 0) return { expanded, unexpanded };

  const expandedIds = new Set(expanded.map(n => n.node.id));
  const extra: AnchoredNeighbor[] = [];
  const remainingUnexpanded: AnchoredNeighbor[] = [];

  for (const neighbor of unexpanded) {
    if (forcedIds.has(neighbor.node.id) && !expandedIds.has(neighbor.node.id)) {
      extra.push(neighbor);
      expandedIds.add(neighbor.node.id);
    } else {
      remainingUnexpanded.push(neighbor);
    }
  }

  for (const id of forcedIds) {
    if (id === anchor.id || expandedIds.has(id)) continue;
    const node = graph.nodes.find(n => n.id === id);
    if (!node) continue; // agent named a node id absent from this manifest — no-op.
    extra.push({ node, edge: bestEdgeBetween(graph, anchor.id, id) });
    expandedIds.add(id);
  }

  return { expanded: [...expanded, ...extra], unexpanded: remainingUnexpanded };
}

/** Best (highest-weight) direct edge between two node ids, in either direction. */
function bestEdgeBetween(graph: KBGraph, a: string, b: string): KBEdge | undefined {
  let best: KBEdge | undefined;
  for (const edge of graph.edges) {
    const matches = (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a);
    if (matches && (!best || edge.weight > best.weight)) best = edge;
  }
  return best;
}

/** Constrain the two neighbor lists to an active `filter`'s resolved id set. No-op when absent. */
function applyNeighborFilter(
  expanded: AnchoredNeighbor[],
  unexpanded: AnchoredNeighbor[],
  filterNodeIds: ReadonlySet<string> | undefined,
): { expanded: AnchoredNeighbor[]; unexpanded: AnchoredNeighbor[] } {
  if (!filterNodeIds) return { expanded, unexpanded };
  return {
    expanded: expanded.filter(n => filterNodeIds.has(n.node.id)),
    unexpanded: unexpanded.filter(n => filterNodeIds.has(n.node.id)),
  };
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
  focused: {
    outlineStyle: 'solid',
    outlineWidth: tokens.strokeWidthThick,
    outlineColor: tokens.colorBrandStroke1,
  },
  onTrace: {
    border: `${tokens.strokeWidthThick} solid ${tokens.colorPaletteMarigoldBorder2}`,
  },
  traceBanner: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  filterHint: {
    color: tokens.colorNeutralForeground3,
  },
});

/** A single expanded neighbor: header (title · relation · weight) + its viewer. */
function ExpandedNeighbor({
  neighbor,
  focused = false,
  onTrace = false,
}: {
  neighbor: AnchoredNeighbor;
  /** This neighbor is the current `expand`'s `focus` node (#409). */
  focused?: boolean;
  /** This neighbor sits on the current `trace` path (#409). */
  onTrace?: boolean;
}) {
  const styles = useStyles();
  const { node, edge } = neighbor;
  return (
    <Card
      appearance="subtle"
      size="small"
      className={mergeClasses(
        styles.neighborCard,
        focused && styles.focused,
        onTrace && styles.onTrace,
      )}
      data-testid="anchor-expanded-neighbor"
      data-node-id={node.id}
      data-kbx-focused={focused || undefined}
      data-kbx-on-trace={onTrace || undefined}
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
function NeighborChip({
  neighbor,
  onTrace = false,
}: {
  neighbor: AnchoredNeighbor;
  /** This neighbor sits on the current `trace` path (#409). */
  onTrace?: boolean;
}) {
  const styles = useStyles();
  const { node, edge } = neighbor;
  const urn = nodeUrn(node);
  return (
    <Button
      as="a"
      href={`#/node/${encodeURIComponent(node.id)}`}
      appearance="outline"
      size="small"
      className={mergeClasses(styles.chip, onTrace && styles.onTrace)}
      title={`${stripScheme(urn)} · ${relationLabel(edge)} · weight ${weightLabel(edge)}`}
      data-testid="anchor-neighbor-chip"
      data-node-id={node.id}
      data-kbx-on-trace={onTrace || undefined}
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
  /** Accumulated agent `expand`/`trace`/`filter` view-actions (#409, cli#214). Optional/additive. */
  viewAction?: AnchorViewAction;
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
  viewAction,
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

  // Layer `expand`/`filter` on top of the ranked partition (#409). Both are
  // no-ops when `viewAction` is absent/empty — memoized so re-renders that
  // don't touch the view-action state (e.g. a theme change) skip the work.
  const { visibleExpanded, visibleUnexpanded } = useMemo(() => {
    if (!anchor) return { visibleExpanded: [], visibleUnexpanded: [] };
    const forced = mergeForcedExpansion(
      graph,
      anchor,
      expanded,
      unexpanded,
      viewAction?.expandedNodeIds,
    );
    const filtered = applyNeighborFilter(
      forced.expanded,
      forced.unexpanded,
      viewAction?.filterNodeIds,
    );
    return { visibleExpanded: filtered.expanded, visibleUnexpanded: filtered.unexpanded };
  }, [graph, anchor, expanded, unexpanded, viewAction?.expandedNodeIds, viewAction?.filterNodeIds]);

  // Precompute the trace path id set (used to highlight matching neighbor
  // cards/chips) before the early return so hook order stays stable.
  const tracePath = viewAction?.trace?.path;
  const traceIds = useMemo(() => new Set(tracePath ?? []), [tracePath]);

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
  const anchorFocused = viewAction?.focusNodeId === anchor.id;
  const filterActive = viewAction?.filterNodeIds !== undefined;
  const noFilterMatches =
    filterActive && visibleExpanded.length === 0 && visibleUnexpanded.length === 0;

  return (
    <div
      className={mergeClasses(styles.root, anchorFocused && styles.focused)}
      data-testid="anchor-first-view"
      data-anchor-id={anchor.id}
      data-kbx-focused={anchorFocused || undefined}
    >
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

      {viewAction?.trace && (
        <>
          <Divider />
          <div
            className={styles.traceBanner}
            data-testid="anchor-trace-banner"
            data-connected={viewAction.trace.connected}
          >
            <Body1 className={styles.sectionTitle}>
              Trace {viewAction.trace.connected ? '— connected' : '— no path found'}
            </Body1>
            <div className={styles.chips}>
              {viewAction.trace.path.map((id, index) => {
                const traceNode = graph.nodes.find(n => n.id === id);
                return (
                  <Badge
                    key={`${id}-${index}`}
                    appearance="outline"
                    color={viewAction.trace?.connected ? 'success' : 'danger'}
                    data-testid="anchor-trace-node"
                    data-node-id={id}
                  >
                    {traceNode?.title ?? id}
                  </Badge>
                );
              })}
            </div>
          </div>
        </>
      )}

      {filterActive && (
        <Caption1 className={styles.filterHint} data-testid="anchor-filter-hint">
          {noFilterMatches
            ? 'Filtered — no neighbors match the current filter.'
            : `Filtered — showing ${visibleExpanded.length + visibleUnexpanded.length} matching neighbor(s).`}
        </Caption1>
      )}

      {visibleExpanded.length > 0 && (
        <>
          <Divider />
          <div className={styles.section} data-testid="anchor-expanded-neighbors">
            <Body1 className={styles.sectionTitle}>Nearest neighbors</Body1>
            {visibleExpanded.map(neighbor => (
              <ExpandedNeighbor
                key={neighbor.node.id}
                neighbor={neighbor}
                focused={viewAction?.focusNodeId === neighbor.node.id}
                onTrace={traceIds.has(neighbor.node.id)}
              />
            ))}
          </div>
        </>
      )}

      {visibleUnexpanded.length > 0 && (
        <div className={styles.section} data-testid="anchor-neighbor-chips">
          <Body1 className={styles.sectionTitle}>Navigate — follow a link for more</Body1>
          <div className={styles.chips}>
            {visibleUnexpanded.map(neighbor => (
              <NeighborChip
                key={neighbor.node.id}
                neighbor={neighbor}
                onTrace={traceIds.has(neighbor.node.id)}
              />
            ))}
          </div>
        </div>
      )}

      {visibleExpanded.length === 0 && visibleUnexpanded.length === 0 && !filterActive && (
        <Caption1 className={styles.sectionTitle} data-testid="anchor-no-neighbors">
          This node has no ranked neighbors yet.
        </Caption1>
      )}
    </div>
  );
}
