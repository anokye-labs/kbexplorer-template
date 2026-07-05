/**
 * GitHub API client wrapper for kbexplorer-template.
 *
 * The GitHub REST client itself (the 7 fetch functions, response types, and
 * error classes) moved to `@anokye-labs/kbexplorer-engine`'s `./sources`
 * subpath in anokye-labs/kbexplorer-template#472, slice 4/5 STEP B. It is a
 * runtime-agnostic, boundary-pure port: no `localStorage`, no module-scope
 * `import.meta.env` reads. The API base is injected per call via an
 * optional `env?: EngineEnv` argument, and caching is injected per call via
 * an optional `cache?: CacheStore` argument (each fetch function checks
 * `cache.get()` before fetching and `cache.set()`s the result on a miss).
 *
 * This file keeps, template-side (a deliberate, disclosed deviation from
 * the pure 1-line-shim pattern used in slices 1-3 — the cache is a
 * browser-storage concern, not an engine concern):
 *  - `resolveImageUrl` — a pure Vite dev-server / GitHub raw-content URL
 *    concern, unrelated to caching, unchanged.
 *  - The localStorage caching machinery (`CACHE_PREFIX`/`CACHE_TTL_MS`/
 *    `CACHE_VERSION`, the version-invalidation IIFE, `cacheGet`/`cacheSet`)
 *    — unchanged behavior, same cache keys, same TTL.
 *  - `localStorageCacheStore`, a `CacheStore` adapter over that machinery,
 *    injected at the one live production call site
 *    (`../engine/remote-loader.ts`'s `GitHubApiSource` construction) so the
 *    live GitHub-fetch path keeps its pre-slice-4 caching behavior
 *    byte-for-byte, even though the fetch functions themselves are now
 *    cache-agnostic by default (no-op cache when none is injected).
 *
 * Everything else below is a straight re-export, keeping every existing
 * import path (`fetchFile`/`fetchTree`/.../`GHIssue`/.../`NotModifiedError`)
 * resolving unchanged for template's type-only consumers (local-loader,
 * files-provider, person-provider, work-provider, manifest-source,
 * repo-data, ...).
 */
import type { SourceConfig } from '../types';
import type { CacheStore } from '@anokye-labs/kbexplorer-engine/sources';

export {
  fetchFile,
  fetchTree,
  fetchIssues,
  fetchPullRequests,
  fetchCommits,
  fetchReleases,
  fetchFiles,
  NotModifiedError,
  RateLimitError,
  GitHubApiError,
} from '@anokye-labs/kbexplorer-engine/sources';
export type {
  GHTreeItem,
  GHIssue,
  GHCommit,
  GHRelease,
  GHFileContent,
  CacheStore,
} from '@anokye-labs/kbexplorer-engine/sources';

const CACHE_PREFIX = 'kbe:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 40; // bump to invalidate all cached data (40: remote/runtime mode's structured-node-map fetch now falls back to `structured-node-map.yml` when `.yaml` is absent, matching local manifest generation's dual-extension support — a repo using the `.yml` extension previously cached a stale `structuredNodeMapRaw: null` under v39; 39: renamed the structured-file node map from `node-map.yaml`/`node-map.ts` to `structured-node-map.yaml`/`structured-node-map.ts` to stop colliding with the older, unrelated `nodemap.yaml`/`nodemap.ts` (repo files → file/content nodes); remote/runtime mode now fetches `structured-node-map.yaml` instead of `node-map.yaml`, so any cached `structuredNodeMapRaw` from a v38-or-earlier client is stale; 38: allowlist markdown sanitizer (#452) — renderSafeMarkdown switched from escape-all to marked → sanitize-html allowlist, so cached node `content` HTML changes for any source carrying raw HTML: legitimate embedded HTML (<details>/<summary>, <img> badges, <table>, <picture>/<source>, GFM task-list <input>) now renders as live safe markup instead of escaped text, entity-encoded scheme colons (javascript&colon; / &#58; / &#x3A; / jav&Tab;ascript:) are normalized-then-defanged, and script/style/iframe/svg/on* handlers are stripped; stale v37 caches would replay pre-sanitizer escaped HTML; 37: identity unification (#445 / AF-003) — content-model nodes now emit a LOCAL `id` (`urnLocalId(urn)`, the URN sans scheme) distinct from their canonical `identity` URN and their edges/connections reference local ids; rich-markdown authored nodes normalize to `id: <doc slug>` + `identity: urn:content:<id>` (was id === identity === `kg://…`); external (wikipedia/orgchart) nodes gain `urn:external:<provider>:<id>` identities; person nodes carry core-v0.3.0 `linkedRefs`; 36: authored rich-Markdown integration (#431) — authored docs declaring `display: rich-markdown` are ingested via @anokye-labs/kbexplorer-provider-rich-markdown ./lib into rich-md nodes (data.richMarkdown.blocks + buildAddress identity), changing those nodes' id/shape vs the plain authored path; 35: directed type/relation edge dedupe preserves parallel graph semantics and remote/runtime mode fetches configured structured-content paths, changing content-model nodes/edges; 34: remote/runtime mode structured-content fetch + graph edge semantic dedupe landed on parallel branches; 33: Work metadata dates now render in UTC so issue/PR/commit/release nodes are stable across time zones); 32: Feature H (#275) — first-class `service` + `decision` content-model kinds: services-monorepo entities now emit `service` nodes (owned-by → team, tracked-in → system-of-record) and `decision`/ADR nodes (decided-by → person, affects → workstream/mission) with bespoke ServiceView/DecisionView, folding into the `teamops` cluster like the rest of the kg:// spine); 31: sensemaking pass — content-model entities now anchor to repo-meta via inferred `tracked-in` edge AND their cluster folds from `person`/`squad`/`priority`/`workstream`/`cycle`/`mission`/`org`/`team`/`system-of-record` into a single `teamops` cluster so the kg:// spine no longer floats as 2 disconnected islands or fragments the legend into 9 singleton chips); 30: sensemaking pass — issues no longer cluster by per-label (all land in `work`); issues, PRs, commits, branches all carry a typed `tracked-in` edge + `parent` to `repo-meta`; repo-meta links to repo-root with a `contains` edge so the file tree and GitHub repo coexist as one cluster; phantom #NNN cross-references are filtered to known issues/PRs only; 29: person nodes (#235) — GHIssue.user added to the cached issue shape, person nodes derived from work data; 28: release nodes — GHRelease shape added, releases fetched from /repos/{owner}/{repo}/releases, NodeSource union extended with `release`, Work view includes release nodes; 27: content-model nodes carry sourceFile {path,raw,format} for the F5 source-of-truth editor → PR write-back; 26: cross-repo vocabulary/synonym mapping (#153) — alias @type canonicalized to its kind + `jsonld.nativeType` preserving the repo's native term; 25: T5.3 F5 custom JS theme-module loader — config.theme.moduleUrl/moduleThemeName opt into dynamically import()ing a host-provided ESM module that exports a Fluent Theme/BrandVariants, registered into the THEME_MAP, changing the cached config shape; 24: T5.1 F5 external theme file — config.theme.themesFile points at a dedicated host-repo theme file fetched at runtime (and captured in the local manifest as themeFileRaw) and merged into the THEME_MAP, so the cached content shape now includes external-file themes; 23: T5.2 F5 raw CSS override sheet — config.branding.css now records a host-repo CSS path/URL injected as the last <link rel=stylesheet>, changing the cached config shape; 22: T4.2 F4 per-page accent/theme — node frontmatter accent/tokens/theme (KBNode.pageTheme) now restyle individual reading pages via scoped CSS vars, changing the cached render's node shape; 21: T4.1 F4 per-cluster token deltas — config.clusters.<id>.tokens now shift cluster-scoped surfaces (cards/badges/reading header) via scoped CSS vars, affecting cached render; 20: T2.4 F2 config-driven brand — theme cycle + persistence now span config.theme.themes.*; selectable theme set is dynamic (built-ins + config themes) and stored kbe-theme is validated against it, changing the cached render's theme shape; 19: F3 branding.favicon config field swaps document <link rel=icon> at runtime — affects cached render; 18: F3 branding.logo config field renders on HomePage hero + HUD header — affects cached render; 17: F1 config-driven appearance — theme.default initial mode + theme.font.* CSS vars now affect cached render; 16: skill node type — .github/skills/**/SKILL.md → SkillView; 15: F3 structural nodes + node-map JSON-LD merged with content-model spine ingestion; 13: KBNode JSON-LD fields + KBEdge.relation)

// Clear stale cache from older versions
try {
  const storedVersion = localStorage.getItem('kbe:version');
  if (storedVersion !== String(CACHE_VERSION)) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem('kbe:version', String(CACHE_VERSION));
  }
} catch { /* localStorage unavailable */ }

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function cacheGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — skip silently
  }
}

/**
 * `CacheStore` adapter over the localStorage machinery above. Injected at
 * `../engine/remote-loader.ts`'s `GitHubApiSource` construction (the one
 * live production call site that needs it — `ManifestSource` and the
 * engine's `loadConfig`/`loadRepoContent`/`loadAuthoredContent` loaders
 * have no other live template callers post-shim-swap) so the engine's
 * cache-agnostic-by-default fetch functions keep caching exactly as they
 * did before this file's fetch-fn bodies moved.
 */
export const localStorageCacheStore: CacheStore = {
  get: <T,>(key: string) => cacheGet<T>(key),
  set: <T,>(key: string, value: T) => cacheSet(key, value),
};

const GH_API_BASE = import.meta.env.VITE_GH_API_BASE ?? 'https://api.github.com';

/** Resolve an image path to a URL — local mode uses Vite dev server, remote uses GitHub. */
export function resolveImageUrl(source: SourceConfig, path: string): string {
  if (import.meta.env.VITE_KB_LOCAL === 'true' || import.meta.env.DEV) {
    return `${import.meta.env.BASE_URL || '/'}${path}`;
  }
  const branch = source.branch ?? 'main';
  if (GH_API_BASE !== 'https://api.github.com') {
    return `${GH_API_BASE}/repos/${source.owner}/${source.repo}/contents/${path}?ref=${branch}`;
  }
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${branch}/${path}`;
}

