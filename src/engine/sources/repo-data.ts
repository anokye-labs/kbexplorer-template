/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine/sources` (moved in
 * anokye-labs/kbexplorer-template#472, slice 3/5). `RepoData`/`RepoMetadata`/
 * `RepoPullRequest`/`RepoSource` are types-only (per the disposition table).
 * `ManifestSource`/`GitHubApiSource` remain template-local (slice 4 scope) and
 * import these types back from this shim.
 */
export type {
  RepoData,
  RepoMetadata,
  RepoPullRequest,
  RepoSource,
} from '@anokye-labs/kbexplorer-engine/sources';
