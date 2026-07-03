/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine` (moved in
 * anokye-labs/kbexplorer-template#472, slice 1/5).
 */
export {
  readmeTransform,
  issueDirectoryLinkTransform,
  issueSplitTransform,
  DEFAULT_TRANSFORMS,
  applyTransforms,
} from '@anokye-labs/kbexplorer-engine';
export type { TransformContext, GraphTransform } from '@anokye-labs/kbexplorer-engine';