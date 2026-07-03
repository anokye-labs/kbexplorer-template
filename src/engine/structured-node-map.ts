/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine` (moved in
 * anokye-labs/kbexplorer-template#472, slice 1/5).
 *
 * `matchRule`, `globToRegex` (local), `StructuredFormat`, `NodeMapEdgeRule`,
 * and `ApplyOptions` are internal to this module in the package and are not
 * part of the public barrel — only `slugify` is needed externally (by
 * `providers/structural-provider.ts`, which stays in template until slice 2)
 * and is re-exported below alongside the previously-public API.
 */
export {
  applyStructuredNodeMap,
  inferStructuredNode,
  parseStructuredNodeMap,
  parseStructuredContent,
  reconstructSource,
  slugify,
} from '@anokye-labs/kbexplorer-engine';
export type { StructuredFile, StructuredNodeMap, NodeMapRule } from '@anokye-labs/kbexplorer-engine';