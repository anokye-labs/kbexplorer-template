/**
 * Thin re-export shim (moved in anokye-labs/kbexplorer-template#472, slice
 * 4/5 STEP B).
 *
 * All 9 of parser.ts's original exports now live in
 * `@anokye-labs/kbexplorer-engine`, including `loadAuthoredContent`,
 * `loadRepoContent`, and `loadConfig` — deferred from slice 1 because they
 * depended on the live GitHub REST client, which was ported and made
 * boundary-clean (env + cache injected) in slice 4.
 *
 * These 3 functions have zero live production callers in template today
 * (their only pre-shim-swap caller, `github-api-source.ts`'s `loadConfig`
 * call, now resolves through the engine's own `GitHubApiSource`, which
 * threads its own `cache?: CacheStore` through an internal `loadConfig`
 * call) — so no cache-injection wiring is needed at this shim boundary.
 */
export {
  parseMarkdownFile,
  extractIssueRefs,
  issueToNode,
  splitIntoSections,
  treeToNodes,
  extractClusters,
  loadAuthoredContent,
  loadRepoContent,
  loadConfig,
} from '@anokye-labs/kbexplorer-engine';
export type { IssueToNodeOptions } from '@anokye-labs/kbexplorer-engine';
