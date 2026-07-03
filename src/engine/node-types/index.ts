/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine` (moved in
 * anokye-labs/kbexplorer-template#472, slice 1/5). `registry.ts` moved
 * wholesale (nothing in template imports it directly, only this barrel).
 */
export type { NodeTypeDefinition, NodeLayer } from '@anokye-labs/kbexplorer-engine';
export {
  registerType,
  resolveType,
  hasType,
  getRegisteredTypes,
  registerBuiltInNodeTypes,
  resetNodeTypeRegistry,
  resolveNodeLayer,
  resolveTypeCluster,
} from '@anokye-labs/kbexplorer-engine';