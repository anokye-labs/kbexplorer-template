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
import { assignIdentity } from './identity';
import {
  parseMarkdownFile,
  issueToNode,
  treeToNodes,
  extractClusters,
  buildGraph,
  extractIssueRefs,
  splitIntoSections,
} from '../engine';
import { loadNodeMap } from './nodemap';
import { ProviderRegistry } from './providers';
import { FilesProvider } from './providers/files-provider';
import { AuthoredProvider } from './providers/authored-provider';
import { WorkProvider } from './providers/work-provider';
import { collectProviderNodes } from './orchestrator';
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
    head_branch?: string;
  }>;
  commits: Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
  }>;
  branches?: Array<{ name: string; protected: boolean }>;
  repoMetadata?: {
    name: string;
    description: string;
    html_url: string;
    default_branch: string;
    stargazers_count: number;
    forks_count: number;
    private: boolean;
    topics: string[];
    primary_language: string;
    languages: Array<{ name: string; size: number }>;
    owner: { login: string; avatar_url: string };
  } | null;
  nodemapRaw?: string | null;
  nodemapFiles?: Record<string, string>;
  nodemapDirs?: Record<string, Array<{ path: string; type: 'blob' | 'tree'; size?: number }>>;
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
  const dirNodes = treeToNodes(tree, source.repo);

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

    // Extract inline markdown links from README body: [text](target)
    const readmeConnectedTo = new Set(readmeConns.map(c => c.to));
    for (const m of readme.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const target = m[2].trim();
      if (target.startsWith('http') || target.startsWith('#') || target.startsWith('/')) continue;
      if (target.match(/\.(png|jpg|jpeg|gif|svg|webp|md)$/i)) continue;
      if (readmeConnectedTo.has(target)) continue;
      readmeConns.push({ to: target, description: m[1] });
      readmeConnectedTo.add(target);
    }

    const html = marked.parse(readme, { async: false }) as string;
    nodes.push({
      id: 'readme', title: 'README', cluster: 'docs',
      content: html, rawContent: readme, emoji: 'Document',
      parent: 'repo-root',
      identity: 'urn:content:readme',
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
    const prNode: KBNode = {
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
    };
    prNode.identity = assignIdentity(prNode);
    nodes.push(prNode);
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

// ── Helpers ────────────────────────────────────────────────

/** Convert a simple glob pattern to a RegExp for matching file paths. */
function globToRegex(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i += 1;
      if (pattern[i + 1] === '/') i += 1;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

// ── Full Local Load ────────────────────────────────────────

/**
 * Provider-based loader using the orchestrator pipeline.
 *
 * 1. Registers FilesProvider, AuthoredProvider, WorkProvider
 * 2. Collects nodes from providers in dependency order
 * 3. Applies README creation + cross-linking transforms not yet in providers
 * 4. Builds the final graph
 */
async function loadLocalKnowledgeBaseV2(): Promise<{
  graph: KBGraph;
  config: KBConfig;
}> {
  const manifest = await loadManifest();
  if (!manifest) {
    const config = await loadLocalConfig();
    const graph = buildGraph([], []);
    return { graph, config };
  }

  const config = await loadLocalConfig();

  // ── Register providers ──────────────────────────────────
  const registry = new ProviderRegistry();

  registry.register(
    new FilesProvider(manifest.tree as GHTreeItem[], config.source.repo),
  );

  const listFiles = async (pattern: string): Promise<string[]> => {
    const regex = globToRegex(pattern);
    return Object.keys(manifest.nodemapFiles ?? {}).filter(p => regex.test(p));
  };

  registry.register(
    new AuthoredProvider(
      manifest.authoredContent,
      manifest.nodemapRaw,
      manifest.nodemapFiles,
      manifest.nodemapDirs,
      listFiles,
    ),
  );

  registry.register(
    new WorkProvider(manifest.issues, manifest.pullRequests, manifest.commits, manifest.branches ?? [], manifest.repoMetadata ?? null),
  );

  // ── Register external providers from config ────────────
  if (config.providers && config.providers.length > 0) {
    const { loadExternalProviders } = await import('./plugin-loader');
    const externals = loadExternalProviders(config.providers);
    for (const p of externals) registry.register(p);
  }

  // ── Collect nodes from providers ────────────────────────
  const allNodes = await collectProviderNodes(registry, config);

  // ── Post-processing: transforms not yet in providers ────

  // Identify node subsets for scoped transforms
  const issueNodes = allNodes.filter(
    n => n.source.type === 'issue',
  );
  const dirNodes = allNodes.filter(
    n => n.provider === 'files',
  );

  // README node (cross-references issues + dirs)
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

    // Extract inline markdown links from README body: [text](target)
    const readmeConnectedTo = new Set(readmeConns.map(c => c.to));
    for (const m of readme.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const target = m[2].trim();
      if (target.startsWith('http') || target.startsWith('#') || target.startsWith('/')) continue;
      if (target.match(/\.(png|jpg|jpeg|gif|svg|webp|md)$/i)) continue;
      if (readmeConnectedTo.has(target)) continue;
      readmeConns.push({ to: target, description: m[1] });
      readmeConnectedTo.add(target);
    }

    const html = marked.parse(readme, { async: false }) as string;
    allNodes.push({
      id: 'readme', title: 'README', cluster: 'docs',
      content: html, rawContent: readme, emoji: 'Document',
      parent: 'repo-root',
      identity: 'urn:content:readme',
      connections: readmeConns, source: { type: 'readme' },
    });
  }

  // Auto-link issues → directories (before splitting so connections stay on original nodes)
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
      const idx = allNodes.indexOf(node);
      if (idx >= 0) allNodes.splice(idx, 1);
      expandedIssues.push(...sectionNodes);
    }
  }
  allNodes.push(...expandedIssues);

  // ── Build final graph ───────────────────────────────────
  const clusters = extractClusters(allNodes, config);
  const graph = buildGraph(allNodes, clusters);
  return { graph, config };
}

export async function loadLocalKnowledgeBase(): Promise<{
  graph: KBGraph;
  config: KBConfig;
}> {
  return loadLocalKnowledgeBaseV2();
}

// ── Legacy monolithic loader (kept as fallback reference) ──
//
// export async function loadLocalKnowledgeBase_legacy(): Promise<{
//   graph: KBGraph;
//   config: KBConfig;
// }> {
//   const config = await loadLocalConfig();
//   const manifest = await loadManifest();
//   const repoNodes = await loadLocalRepoContent();
//   const authoredNodes = await loadLocalAuthoredContent();
//
//   let nodemapNodes: KBNode[] = [];
//   if (manifest?.nodemapRaw) {
//     try {
//       nodemapNodes = await loadNodeMap(
//         manifest.nodemapRaw,
//         async (path) => manifest.nodemapFiles?.[path] ?? null,
//         async (pattern) => {
//           const regex = globToRegex(pattern);
//           return Object.keys(manifest.nodemapFiles ?? {}).filter(p => regex.test(p));
//         },
//         async (dir) => manifest.nodemapDirs?.[dir] ?? [],
//       );
//     } catch {
//       console.warn('[local-loader] Failed to load nodemap nodes');
//     }
//   }
//
//   const nodes = [...repoNodes, ...authoredNodes, ...nodemapNodes];
//   const clusters = extractClusters(nodes, config);
//   const graph = buildGraph(nodes, clusters);
//   return { graph, config };
// }
