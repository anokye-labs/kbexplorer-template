/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine/store` (moved in
 * anokye-labs/kbexplorer-template#472, slice 3/5).
 *
 * `sourceIdFor`/`stableStringify`/`contentHashFor`/`hashProviderResultPrefix`
 * are dropped from this shim: they're private derivation-hashing internals of
 * engine's `fingerprint.ts` (not re-exported from its public `./store`
 * subpath) and had zero consumers outside `src/engine/store/` in this repo
 * before the move (verified — only `store-orchestrator.ts`, itself moved,
 * used `hashProviderResultPrefix`).
 */
export {
  GRAPH_STORE_DERIVATION_VERSION,
  GRAPH_STORE_PROVIDER_ID,
  buildProviderResultCacheKey,
} from '@anokye-labs/kbexplorer-engine/store';
