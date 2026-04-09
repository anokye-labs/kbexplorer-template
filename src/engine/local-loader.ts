/**
 * Local content loader for kbexplorer.
 *
 * In local mode, imports the pre-built repo-manifest.json and produces the same
 * KBNode[] and KBConfig as the API-based parser — but with zero runtime API calls.
 */
import yaml from 'yaml';
import { marked } from 'marked';
import type { KBNode, KBConfig, KBGraph } from '../types';
import { DEFAULT_CONFIG } from '../types';
import {
  parseMarkdownFile,
  issueToNode,
  treeToNodes,
  extractClusters,
  buildGraph,
  extractIssueRefs,
  splitIntoSections,
} from '../engine';
import type { GHIssue, GHTreeItem } from '../api';

// ── Manifest Types ─────────────────────────────────────────

interface RepoManifest {
  configRaw: string | null;
  authoredContent: Record<string, string>;
  tree: Array<{ path: string; type: 'blob' | 'tree'; size?: number }>;
  readme: string | null;
  issues: GHIssue[];
  pullRequests: Array<{
    number: number;
    title: string;
    body: string;
    state: string;
    labels: Array<{ name: string; color: string }>;
    html_url: string;
    created_at: string;
    updated_at: string;
  }>;
  commits: Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
  }>;
  generatedAt: string;
}

// ── Manifest Loading ───────────────────────────────────────

let _manifestPromise: Promise<RepoManifest | null> | null = null;

async function loadManifest(): Promise<RepoManifest | null> {
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = (async () => {
    try {
      const mod = await import('../generated/repo-manifest.json');
      return (mod.default ?? mod) as RepoManifest;
    } catch {
      return null;
    }
  })();
  return _manifestPromise;
}

// ── Mode Detection ─────────────────────────────────────────

/** Check if local mode is active (requires explicit VITE_KB_LOCAL=true). */
export function isLocalMode(): boolean {
  return import.meta.env.VITE_KB_LOCAL === 'true';
}

/** Async check — same as isLocalMode but async for hook compatibility. */
export async function detectLocalMode(): Promise<boolean> {
  return isLocalMode();
}

// ── Local Config ───────────────────────────────────────────

export async function loadLocalConfig(): Promise<KBConfig> {
  const manifest = await loadManifest();
  if (!manifest?.configRaw) return { ...DEFAULT_CONFIG };

  try {
    const parsed = yaml.parse(manifest.configRaw) as Partial<KBConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, source: DEFAULT_CONFIG.source };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ── Local Authored Content ─────────────────────────────────

export async function loadLocalAuthoredContent(): Promise<KBNode[]> {
  const manifest = await loadManifest();
  if (!manifest) return [];

  const nodes: KBNode[] = [];
  for (const [path, raw] of Object.entries(manifest.authoredContent)) {
    try {
      nodes.push(parseMarkdownFile(path, raw));
    } catch {
      console.warn(`[local-loader] Failed to parse ${path}, skipping`);
    }
  }
  return nodes;
}

// ── Local Repo Content ─────────────────────────────────────

export async function loadLocalRepoContent(): Promise<KBNode[]> {
  const manifest = await loadManifest();
  if (!manifest) return [];

  const config = await loadLocalConfig();
  const source = config.source;
  const nodes: KBNode[] = [];

  // Issues
  const issueNodes = manifest.issues.map(issueToNode);

  // Tree
  const tree = manifest.tree as GHTreeItem[];
  const dirNodes = treeToNodes(tree, source.repo, source.path ? [source.path.split('/')[0]] : []);

  nodes.push(...issueNodes);
  nodes.push(...dirNodes);

  // README
  if (manifest.readme) {
    const readme = manifest.readme;
    const readmeConns: Array<{ to: string; description: string }> = [];
    const lower = readme.toLowerCase();

    const issueRefs = extractIssueRefs(readme);
    for (const num of issueRefs) {
      const id = `issue-${num}`;
      if (issueNodes.some(n => n.id === id)) {
        readmeConns.push({ to: id, description: `References #${num}` });
      }
    }
    for (const node of issueNodes) {
      if (readmeConns.some(c => c.to === node.id)) continue;
      const titleWords = node.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (titleWords.length === 0) continue;
      const matchCount = titleWords.filter(w => lower.includes(w)).length;
      if (matchCount >= Math.ceil(titleWords.length * 0.6)) {
        readmeConns.push({ to: node.id, description: 'Mentions' });
      }
    }
    for (const dir of dirNodes) {
      const dirName = dir.title.replace(/\/$/, '');
      if (lower.includes(`${dirName}/`) || lower.includes(`\`${dirName}\``)) {
        readmeConns.push({ to: dir.id, description: `References ${dirName}/` });
      }
    }
    readmeConns.push({ to: 'repo-root', description: 'Documents' });

    const html = marked.parse(readme, { async: false }) as string;
    nodes.push({
      id: 'readme', title: 'README', cluster: 'docs',
      content: html, rawContent: readme, emoji: 'Document',
      parent: 'repo-root',
      connections: readmeConns, source: { type: 'readme' },
    });
  }

  // Auto-link issues → directories (before splitting so connections stay on the original nodes)
  const dirNames = dirNodes.map(d => d.title.replace(/\/$/, ''));
  for (const node of issueNodes) {
    for (let i = 0; i < dirNames.length; i++) {
      const dir = dirNames[i];
      if (node.rawContent && (
        node.rawContent.includes(`${dir}/`) ||
        node.rawContent.includes(`\`${dir}\``) ||
        node.rawContent.toLowerCase().includes(dir.toLowerCase())
      )) {
        node.connections.push({ to: dirNodes[i].id, description: `References ${dir}/` });
      }
    }
  }

  // Split issues with 2+ headings into parent + section nodes
  const expandedIssues: KBNode[] = [];
  for (const node of issueNodes) {
    const sectionNodes = splitIntoSections(
      node.id, node.title, node.rawContent, node.cluster, node.emoji ?? 'Pin',
      node.source, [...issueNodes, ...dirNodes],
    );
    if (sectionNodes.length > 0) {
      const idx = nodes.indexOf(node);
      if (idx >= 0) nodes.splice(idx, 1);
      expandedIssues.push(...sectionNodes);
    }
  }
  nodes.push(...expandedIssues);

  // Pull requests as nodes
  for (const pr of manifest.pullRequests) {
    const body = pr.body ?? '';
    const html = marked.parse(body, { async: false }) as string;
    const refs = extractIssueRefs(body);
    nodes.push({
      id: `pr-${pr.number}`,
      title: pr.title,
      cluster: 'pull-request',
      content: html,
      rawContent: body,
      emoji: 'BranchFork',
      connections: refs.map(n => ({
        to: `issue-${n}`,
        description: `References #${n}`,
      })),
      source: { type: 'pull_request', number: pr.number, state: pr.state },
    });
  }

  // Commits as nodes (grouped)
  if (manifest.commits.length > 0) {
    const commitList = manifest.commits
      .slice(0, 30)
      .map(c => `- \`${c.sha.substring(0, 7)}\` ${c.commit.message}`)
      .join('\n');
    const commitContent = `## Recent Commits\n\n${manifest.commits.length} commits\n\n${commitList}`;
    const commitHtml = marked.parse(commitContent, { async: false }) as string;
    nodes.push({
      id: 'commits',
      title: 'Recent Commits',
      cluster: 'commits',
      content: commitHtml,
      rawContent: commitContent,
      emoji: 'History',
      connections: [],
      source: { type: 'file', path: '.git/log' },
    });
  }

  return nodes;
}

// ── Full Local Load ────────────────────────────────────────

export async function loadLocalKnowledgeBase(): Promise<{
  graph: KBGraph;
  config: KBConfig;
}> {
  const config = await loadLocalConfig();
  const repoNodes = await loadLocalRepoContent();
  const authoredNodes = await loadLocalAuthoredContent();
  const nodes = [...repoNodes, ...authoredNodes];
  const clusters = extractClusters(nodes, config);
  const graph = buildGraph(nodes, clusters);
  return { graph, config };
}
