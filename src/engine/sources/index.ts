/**
 * Source adapters (Phase 4 / F4 #318): system-of-record implementations of the
 * pure {@link Source} contract that feed the unified loader.
 */
export type { RepoData, RepoSource, RepoPullRequest, RepoMetadata } from './repo-data';
export { ManifestSource } from './manifest-source';
export { GitHubApiSource, type ResolutionPreset } from './github-api-source';
