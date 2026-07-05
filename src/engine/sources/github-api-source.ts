/**
 * Thin re-export shim (moved in anokye-labs/kbexplorer-template#472, slice
 * 4/5 STEP B). `GitHubApiSource`'s real implementation now lives in
 * `@anokye-labs/kbexplorer-engine`'s `./sources` subpath — its constructor
 * takes an optional trailing `cache?: CacheStore` seam (see
 * `../remote-loader.ts`, which injects the template's localStorage-backed
 * `localStorageCacheStore` from `../../api/github` to preserve the
 * pre-slice-4 caching behavior).
 */
export { GitHubApiSource, type ResolutionPreset } from '@anokye-labs/kbexplorer-engine/sources';
