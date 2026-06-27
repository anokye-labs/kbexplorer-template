/**
 * Remote content loader for kbexplorer.
 *
 * Fetches GitHub data at runtime and feeds it through the provider pipeline,
 * producing the same KBGraph as the local loader but from live API data.
 *
 * Resolution presets control how much data to fetch:
 * - summary: issues + README (fast, minimal API usage)
 * - standard: issues + PRs + README + tree + authored content
 * - full: standard + commits
 */
import type { KBGraph, KBConfig, SourceConfig } from '../types'
import { DEFAULT_CONFIG } from '../types'
import {
  fetchIssues,
  fetchPullRequests,
  fetchTree,
  fetchFile,
  fetchFiles,
  fetchCommits,
  fetchReleases,
} from '../api'
import type { GHIssue, GHTreeItem, GHCommit, GHRelease } from '../api'
import { loadConfig } from '../engine'
import { ProviderRegistry } from './providers'
import { FilesProvider } from './providers/files-provider'
import { AuthoredProvider } from './providers/authored-provider'
import { WorkProvider } from './providers/work-provider'
import { PersonProvider } from './providers/person-provider'
import { StructuralProvider } from './providers/structural-provider'
import { ContentModelProvider } from './providers/content-model-provider'
import { orchestrateWithTransforms } from './orchestrator'
import { applyExternalThemeFile } from '../theme/externalTheme'

export type ResolutionPreset = 'summary' | 'standard' | 'full'

interface FetchedData {
  issues: GHIssue[]
  pullRequests: GHIssue[]
  tree: GHTreeItem[]
  readme: string | null
  commits: GHCommit[]
  releases: GHRelease[]
  authoredContent: Record<string, string>
  structuralFiles: Record<string, string>
  structuredNodeMapRaw: string | null
  config: KBConfig
}

/** Whether a repo path is a `.github` structural artifact or a CODEOWNERS file. */
function isStructuralPath(path: string): boolean {
  return path.startsWith('.github/') || /(^|\/)CODEOWNERS$/.test(path)
}

/** Skip oversized `.github` blobs (mirrors the local manifest cap). */
const MAX_STRUCTURAL_FILE_SIZE = 256 * 1024

/**
 * Fetch GitHub data according to a resolution preset.
 */
async function fetchGitHubData(
  source: SourceConfig,
  preset: ResolutionPreset,
): Promise<FetchedData> {
  const config = await loadConfig(source)

  // F5/T5.1: merge a dedicated host-repo theme file (config.theme.themesFile)
  // into the theme block before the THEME_MAP is built. Fetched like config.yaml
  // (repo-relative path via fetchFile); a missing/malformed file is a no-op.
  // Since applyExternalThemeFile is no-throw/no-op on failure, fetch it in
  // parallel with issues/README rather than adding a serial round-trip.
  const themeFilePromise = config.theme?.themesFile
    ? applyExternalThemeFile(config.theme, p => fetchFile(source, p))
    : null

  // All presets fetch issues + README + releases
  const [issues, readme, releases, mergedTheme] = await Promise.all([
    fetchIssues(source).catch(() => [] as GHIssue[]),
    fetchFile(source, 'README.md').catch(() => null),
    fetchReleases(source).catch(() => [] as GHRelease[]),
    themeFilePromise,
  ])

  if (mergedTheme) {
    config.theme = mergedTheme
  }

  let tree: GHTreeItem[] = []
  let pullRequests: GHIssue[] = []
  let commits: GHCommit[] = []
  const authoredContent: Record<string, string> = {}
  const structuralFiles: Record<string, string> = {}
  let structuredNodeMapRaw: string | null = null

  if (preset === 'standard' || preset === 'full') {
    const [treeResult, prResult] = await Promise.all([
      fetchTree(source).catch(() => [] as GHTreeItem[]),
      fetchPullRequests(source).catch(() => [] as GHIssue[]),
    ])
    tree = treeResult
    pullRequests = prResult

    // Fetch authored content if config specifies a content path
    if (config.source.path) {
      try {
        const contentTree = await fetchTree(source, config.source.path)
        const mdFiles = contentTree
          .filter(item => item.type === 'blob' && item.path.endsWith('.md'))
          .map(item => item.path)
        const files = await fetchFiles(source, mdFiles)
        for (const [path, content] of files) {
          authoredContent[path] = content
        }
      } catch {
        // Content directory may not exist
      }
    }

    // Fetch `.github` structural artifacts + the declarative node-map.
    try {
      const structuralPaths = tree
        .filter(item =>
          item.type === 'blob' &&
          isStructuralPath(item.path) &&
          !(typeof item.size === 'number' && item.size > MAX_STRUCTURAL_FILE_SIZE),
        )
        .map(item => item.path)
      if (structuralPaths.length > 0) {
        const files = await fetchFiles(source, structuralPaths)
        for (const [path, content] of files) {
          // Guard again on content length for blobs whose tree size was absent.
          if (content.length > MAX_STRUCTURAL_FILE_SIZE) continue
          structuralFiles[path] = content
        }
      }
      structuredNodeMapRaw = await fetchFile(source, 'node-map.yaml').catch(() => null)
    } catch {
      // `.github` may not exist — safe no-op.
    }
  }

  if (preset === 'full') {
    commits = await fetchCommits(source).catch(() => [] as GHCommit[])
  }

  return { issues, pullRequests, tree, readme, commits, releases, authoredContent, structuralFiles, structuredNodeMapRaw, config }
}

/**
 * Load the knowledge base from live GitHub API data using the provider pipeline.
 */
export async function loadRemoteKnowledgeBase(
  sourceOverride?: SourceConfig,
  preset: ResolutionPreset = 'standard',
): Promise<{ graph: KBGraph; config: KBConfig }> {
  const source = sourceOverride ?? DEFAULT_CONFIG.source
  const data = await fetchGitHubData(source, preset)
  const { config } = data

  // ── Register providers with fetched data ───────────────
  const registry = new ProviderRegistry()

  if (data.tree.length > 0) {
    registry.register(new FilesProvider(data.tree, source.repo))
  }

  if (Object.keys(data.authoredContent).length > 0) {
    registry.register(new AuthoredProvider(
      data.authoredContent,
      null,  // no nodemap in remote mode (yet)
      undefined,
      undefined,
      async () => [],
    ))
  }

  // PRs need to be shaped to match WorkProvider's constructor type
  const shapedPRs = data.pullRequests.map(pr => ({
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state: pr.state,
    labels: pr.labels,
    html_url: pr.html_url,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
  }))

  registry.register(new WorkProvider(data.issues, shapedPRs, data.commits, [], null, data.releases))

  // People derived from GitHub activity (#235) — author/assignee data comes
  // straight off the API responses.
  registry.register(new PersonProvider(
    data.issues,
    data.pullRequests.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      html_url: pr.html_url,
      user: pr.user,
      assignees: pr.assignees,
    })),
  ))

  // ── Structural discovery (.github → repository node) ────
  if (Object.keys(data.structuralFiles).length > 0) {
    registry.register(new StructuralProvider(data.structuralFiles, data.structuredNodeMapRaw))
  }

  // Content-model spine (F2). The sunset content-model source is not fetched at
  // runtime yet; register as a safe no-op so the wiring is in place and output
  // stays byte-identical until a remote content-model fetch path lands.
  registry.register(new ContentModelProvider(null))

  // ── Register external providers from config ────────────
  if (config.providers && config.providers.length > 0) {
    const { loadExternalProviders } = await import('./plugin-loader')
    const externals = loadExternalProviders(config.providers)
    for (const p of externals) registry.register(p)
  }

  // ── Collect provider nodes, run the shared transform stage, build graph ─
  const graph = await orchestrateWithTransforms(registry, config, { readme: data.readme })
  return { graph, config }
}
