/**
 * mountConstellationNetwork — mounting logic for {@link ConstellationView}
 * (#453), split into its own module (not a component file) so:
 *
 *  1. `react-refresh/only-export-components` stays happy — component files
 *     should only export components, and this is a plain function.
 *  2. It's directly unit-testable by injecting a fake `createGraphNetworkFn` +
 *     `navigate`, without needing a real DOM/vis-network instance (this
 *     repo's unit tests run under Node, not jsdom). The actual live-canvas
 *     mount — full-viewport sizing, drag-pan/scroll-zoom, and the real
 *     click-to-navigate interaction — is verified by the
 *     `e2e/canvas-embed.spec.ts` Playwright spec.
 */
import type { KBGraph } from '../../../types';
import {
  createGraphNetwork as createGraphNetworkImpl,
  type GraphNetworkOptions,
  type GraphNetworkResult,
} from '../../graph-canvas/createGraphNetwork';

/**
 * Mount a live {@link createGraphNetworkImpl} instance into `container` and
 * return its cleanup (`network.destroy()`).
 */
export function mountConstellationNetwork(
  container: HTMLElement,
  graph: KBGraph,
  isDark: boolean,
  navigate: (path: string) => void,
  createGraphNetworkFn: (options: GraphNetworkOptions) => GraphNetworkResult = createGraphNetworkImpl,
): () => void {
  const { network } = createGraphNetworkFn({
    container,
    graph,
    isDark,
    interactive: true,
    fitOnStabilize: true,
    onNodeClick: nodeId => navigate(`/node/${encodeURIComponent(nodeId)}`),
    auditSlot: 'copilotConstellation',
  });
  return () => {
    try { network.destroy(); } catch { /* already torn down */ }
  };
}
