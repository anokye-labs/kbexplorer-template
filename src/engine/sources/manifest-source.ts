/**
 * Thin re-export shim (moved in anokye-labs/kbexplorer-template#472, slice
 * 4/5 STEP B). `ManifestSource` is read-only over an already-populated
 * `RepoManifest` and does no live fetches, so it needs no cache injection.
 */
export { ManifestSource } from '@anokye-labs/kbexplorer-engine/sources';
