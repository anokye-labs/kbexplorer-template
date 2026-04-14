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
import { marked } from 'marked'
import type { KBGraph, KBConfig, SourceConfig } from '../types'
import { DEFAULT_CONFIG } from '../types'
import {
  fetchIssues,
  fetchPullRequests,
  fetchTree,
  fetchFile,
  fetchFiles,
  fetchCommits,
} from '../api'
import type { GHIssue, GHTreeItem, GHCommit } from '../api'
import {
  loadConfig,
  extractClusters,
  buildGraph,
  issueToNode,
  extractIssueRefs,
  splitIntoSections,
  treeToNodes,
  parseMarkdownFile,
} from '../engine'
import { ProviderRegistry } from './providers'
import { FilesProvider } from './providers/files-provider'
import { AuthoredProvider } from './providers/authored-provider'
import { WorkProvider } from './providers/work-provider'
import { collectProviderNodes } from './orchestrator'

export type ResolutionPreset = 'summary' | 'standard' | 'full'

interface FetchedData {
  issues: GHIssue[]
  pullRequests: GHIssue[]
  tree: GHTreeItem[]
  readme: string | null
  commits: GHCommit[]
  authoredContent: Record<string, string>
  config: KBConfig
}

/**
 * Fetch GitHub data according to a resolution preset.
 */
async function fetchGitHubData(
  source: SourceConfig,
  preset: ResolutionPreset,
): Promise<FetchedData> {
  const config = await loadConfig(source)

  // All presets fetch issues + README
  const [issues, readme] = await Promise.all([
    fetchIssues(source).catch(() => [] as GHIssue[]),
    fetchFile(source, 'README.md').catch(() => null),
  ])

  let tree: GHTreeItem[] = []
  let pullRequests: GHIssue[] = []
  let commits: GHCommit[] = []
  let authoredContent: Record<string, string> = {}

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
  }

  if (preset === 'full') {
    commits = await fetchCommits(source).catch(() => [] as GHCommit[])
  }

  return { issues, pullRequests, tree, readme, commits, authoredContent, config }
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
      null,
      null,
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

  registry.register(new WorkProvider(data.issues, shapedPRs, data.commits))

  // ── Register external providers from config ────────────
  if (config.providers && config.providers.length > 0) {
    const { loadExternalProviders } = await import('./plugin-loader')
    const externals = loadExternalProviders(config.providers)
    for (const p of externals) registry.register(p)
  }

  // ── Collect nodes from providers ───────────────────────
  const allNodes = await collectProviderNodes(registry, config)

  // ── Post-processing: README + cross-linking ────────────
  const issueNodes = allNodes.filter(n => n.source.type === 'issue')
  const dirNodes = allNodes.filter(n => n.provider === 'files')

  if (data.readme) {
    const readme = data.readme
    const readmeConns: Array<{ to: string; description: string }> = []
    const lower = readme.toLowerCase()

    const issueRefs = extractIssueRefs(readme)
    for (const num of issueRefs) {
      const id = `issue-${num}`
      if (issueNodes.some(n => n.id === id)) {
        readmeConns.push({ to: id, description: `References #${num}` })
      }
    }
    for (const node of issueNodes) {
      if (readmeConns.some(c => c.to === node.id)) continue
      const titleWords = node.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      if (titleWords.length === 0) continue
      const matchCount = titleWords.filter(w => lower.includes(w)).length
      if (matchCount >= Math.ceil(titleWords.length * 0.6)) {
        readmeConns.push({ to: node.id, description: 'Mentions' })
      }
    }
    for (const dir of dirNodes) {
      const dirName = dir.title.replace(/\/$/, '')
      if (lower.includes(`${dirName}/`) || lower.includes(`\`${dirName}\``)) {
        readmeConns.push({ to: dir.id, description: `References ${dirName}/` })
      }
    }
    readmeConns.push({ to: 'repo-root', description: 'Documents' })

    // Extract inline markdown links
    const readmeConnectedTo = new Set(readmeConns.map(c => c.to))
    for (const m of readme.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const target = m[2].trim()
      if (target.startsWith('http') || target.startsWith('#') || target.startsWith('/')) continue
      if (target.match(/\.(png|jpg|jpeg|gif|svg|webp|md)$/i)) continue
      if (readmeConnectedTo.has(target)) continue
      readmeConns.push({ to: target, description: m[1] })
      readmeConnectedTo.add(target)
    }

    const html = marked.parse(readme, { async: false }) as string
    allNodes.push({
      id: 'readme', title: 'README', cluster: 'docs',
      content: html, rawContent: readme, emoji: 'Document',
      parent: 'repo-root',
      identity: 'urn:content:readme',
      connections: readmeConns, source: { type: 'readme' },
    })
  }

  // Auto-link issues → directories
  const dirNames = dirNodes.map(d => d.title.replace(/\/$/, ''))
  for (const node of issueNodes) {
    for (let i = 0; i < dirNames.length; i++) {
      const dir = dirNames[i]
      if (node.rawContent && (
        node.rawContent.includes(`${dir}/`) ||
        node.rawContent.includes(`\`${dir}\``) ||
        node.rawContent.toLowerCase().includes(dir.toLowerCase())
      )) {
        node.connections.push({ to: dirNodes[i].id, description: `References ${dir}/` })
      }
    }
  }

  // Split issues with 2+ headings
  const expandedIssues = []
  for (const node of issueNodes) {
    const sectionNodes = splitIntoSections(
      node.id, node.title, node.rawContent, node.cluster, node.emoji ?? 'Pin',
      node.source, [...issueNodes, ...dirNodes],
    )
    if (sectionNodes.length > 0) {
      const idx = allNodes.indexOf(node)
      if (idx >= 0) allNodes.splice(idx, 1)
      expandedIssues.push(...sectionNodes)
    }
  }
  allNodes.push(...expandedIssues)

  // ── Build final graph ──────────────────────────────────
  const clusters = extractClusters(allNodes, config)
  const graph = buildGraph(allNodes, clusters)
  return { graph, config }
}
