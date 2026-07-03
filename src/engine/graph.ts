/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine` (moved in
 * anokye-labs/kbexplorer-template#472, slice 1/5). `node.layer` stamping
 * (via `resolveNodeLayer`, now `node-types/registry.ts` in the package) and
 * the `EDGE_TYPE_WEIGHTS`-derived edge weighting are preserved as before —
 * only the implementation now lives in the package.
 */
export {
  buildGraph,
  getNodeDegrees,
  getHubNodeId,
  getEdgeDescription,
} from '@anokye-labs/kbexplorer-engine';
