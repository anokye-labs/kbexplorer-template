/**
 * ConstellationView — full-viewport, interactive force-directed graph for the
 * `copilot` target's `/constellation` route (#453, epic #407 / #401).
 *
 * `AnchorFirstView` (#408) demotes the constellation to an optional zoom-out
 * reached via its "Constellation" button (`data-testid="constellation-zoom-out"`,
 * `href="#/constellation"`). Before this component existed, that route rendered
 * `HomePage` — the SPA's decorative landing hero, whose only graph visual
 * (`ConstellationHero`) is a translucent, non-interactive band fixed at
 * `height: '35vh'` (physics disabled after a single `fit()`, no
 * `interactive: true`). Clicking a node did nothing; the only affordances were
 * CTA buttons that linked to a fixed node.
 *
 * #453 fixes this: `/constellation` now mounts the SAME `createGraphNetwork`
 * engine helper `HUD`'s expanded-map overlay uses — `interactive: true` for
 * drag-pan + scroll-zoom, `fitOnStabilize: true`, and node clicks re-anchor
 * the panel (`navigate('/node/<id>')`) instead of doing nothing — mounted
 * full-bleed instead of a fixed-height decoration.
 *
 * ADDITIVE: `HomePage`/`ConstellationHero` are untouched — still used by the
 * full-page SPA landing (`App`/`main.tsx`) and the `homepage` display mode
 * (`ReadingView`). This is purely a new route target inside the `copilot`
 * target's own narrow `<Routes>` (`copilot.tsx`).
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowLeftRegular } from '@fluentui/react-icons';
import type { KBConfig, KBGraph } from '../../../types';
import { useIsDark } from '../../../theme/isDarkContext';
import { mountConstellationNetwork } from './mountConstellationNetwork';

const useStyles = makeStyles({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  stats: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
  },
  canvas: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
  },
});

export interface ConstellationViewProps {
  graph: KBGraph;
  config: KBConfig;
}

/**
 * Full-viewport zoom-out: the real explorable constellation (drag-pan,
 * scroll-zoom, click-to-select) — not the fixed-height decorative hero.
 */
export function ConstellationView({ graph, config }: ConstellationViewProps) {
  const styles = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = useIsDark();
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;
    return mountConstellationNetwork(containerRef.current, graph, isDark, navigate);
  }, [graph, isDark, navigate]);

  return (
    <div className={styles.root} data-testid="constellation-view">
      <div className={styles.header}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
          Back
        </Button>
        <Caption1 className={styles.stats} data-testid="constellation-stats">
          {graph.nodes.length} nodes · {graph.edges.length} links · click a node to open it
        </Caption1>
      </div>
      <div
        ref={containerRef}
        className={styles.canvas}
        data-testid="constellation-canvas"
        aria-label={`${config.title} — interactive knowledge constellation`}
      />
    </div>
  );
}
