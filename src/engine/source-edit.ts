/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine` (moved in
 * anokye-labs/kbexplorer-template#472, slice 1/5).
 */
export {
  canEditSource,
  resolveSourceFile,
  validateSourceContent,
  repoCoordsFromConfig,
  encodeRepoPath,
  buildEditUrl,
  buildNewFileUrl,
  buildHandoffUrl,
  buildUnifiedDiff,
  patchFilename,
  buildSourceEditHandoff,
  normalizeNewlines,
} from '@anokye-labs/kbexplorer-engine';
export type { RepoCoords, ValidationResult, SourceEditHandoff } from '@anokye-labs/kbexplorer-engine';