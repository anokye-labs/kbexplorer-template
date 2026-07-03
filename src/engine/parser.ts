/**
 * Hybrid shim (moved in anokye-labs/kbexplorer-template#472, slice 1/5).
 *
 * 6 of parser.ts's 9 exports were pure (no live GitHub client dependency)
 * and moved to `@anokye-labs/kbexplorer-engine` verbatim: `parseMarkdownFile`,
 * `extractIssueRefs`, `issueToNode`, `splitIntoSections`, `treeToNodes`,
 * `extractClusters`. They are re-exported below.
 *
 * `loadAuthoredContent`, `loadRepoContent`, and `loadConfig` call the live
 * GitHub REST client (`fetchFile`/`fetchTree`/`fetchFiles`/`fetchIssues` from
 * `../api`) — that client is not boundary-clean yet (reads Vite's
 * import-meta env / `localStorage`) and its Node-safe DI port is slice 4's
 * job (per plan.md). Until then these 3 functions stay implemented locally,
 * using template's still-in-place `../api` and the package's re-exported
 * pure helpers, exactly matching their pre-move behavior.
 */
import {
  parseMarkdownFile,
  extractIssueRefs,
  issueToNode,
  splitIntoSections,
  treeToNodes,
  extractClusters,
  renderSafeMarkdown,
} from '@anokye-labs/kbexplorer-engine';
import type { IssueToNodeOptions } from '@anokye-labs/kbexplorer-engine';
import type { KBNode, KBConfig, Connection, SourceConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import yaml from 'yaml';
import {
  fetchFile,
  fetchTree,
  fetchFiles,
  fetchIssues,
  type GHIssue,
  type GHTreeItem,
} from '../api';

export {
  parseMarkdownFile,
  extractIssueRefs,
  issueToNode,
  splitIntoSections,
  treeToNodes,
  extractClusters,
};
export type { IssueToNodeOptions };

/** Load authored content from a content directory in the repo. */
export async function loadAuthoredContent(
  source: SourceConfig,
  contentPath: string
): Promise<KBNode[]> {
  const tree = await fetchTree(source, contentPath);
  const mdFiles = tree
    .filter(item => item.type === 'blob' && item.path.endsWith('.md'))
    .map(item => item.path);

  const files = await fetchFiles(source, mdFiles);
  const nodes: KBNode[] = [];

  for (const [path, content] of files) {
    try {
      nodes.push(parseMarkdownFile(path, content));
    } catch {
      console.warn(`[kbexplorer] Failed to parse ${path}, skipping`);
    }
  }

  return nodes;
}

/** Load repo-aware content: issues, README, and directory structure. */
export async function loadRepoContent(source: SourceConfig): Promise<KBNode[]> {
  const [issues, tree, readme] = await Promise.all([
    fetchIssues(source).catch(() => [] as GHIssue[]),
    fetchTree(source).catch(() => [] as GHTreeItem[]),
    fetchFile(source, 'README.md').catch(() => null),
  ]);

  const nodes: KBNode[] = [];

  // Pre-compute the valid issue/PR id sets so issueToNode can filter phantom
  // #NNN references (this used to produce hundreds of dangling edges).
  const knownIssueNumbers = new Set(issues.filter(i => !(i as { pull_request?: unknown }).pull_request).map(i => i.number));
  const knownPrNumbers = new Set(issues.filter(i => (i as { pull_request?: unknown }).pull_request).map(i => i.number));
  const issueNodes = issues.map(i => issueToNode(i, {
    knownIssueNumbers,
    knownPrNumbers,
    repoNodeId: 'repo-meta',
  }));
  const dirNodes = treeToNodes(tree, source.repo);

  nodes.push(...issueNodes);
  nodes.push(...dirNodes);

  // README as a single node with content-based connections
  if (readme) {
    const readmeConns: Connection[] = [];
    const lower = readme.toLowerCase();
    const issueRefs = extractIssueRefs(readme);
    for (const num of issueRefs) {
      const id = `issue-${num}`;
      if (issueNodes.some(n => n.id === id)) {
        readmeConns.push({ to: id, type: 'cross_references', description: `References #${num}`, source: 'inline' });
      }
    }
    for (const node of issueNodes) {
      if (readmeConns.some(c => c.to === node.id)) continue;
      const titleWords = node.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (titleWords.length === 0) continue;
      const matchCount = titleWords.filter(w => lower.includes(w)).length;
      if (matchCount >= Math.ceil(titleWords.length * 0.6)) {
        readmeConns.push({ to: node.id, type: 'mentions', description: 'Mentions', source: 'inferred' });
      }
    }
    for (const dir of dirNodes) {
      const dirName = dir.title.replace(/\/$/, '');
      if (lower.includes(`${dirName}/`) || lower.includes(`\`${dirName}\``)) {
        readmeConns.push({ to: dir.id, type: 'references', description: `References ${dirName}/`, source: 'inferred' });
      }
    }
    readmeConns.push({ to: 'repo-root', type: 'contains', description: 'Documents', source: 'inferred' });

    // Extract inline markdown links from README body: [text](target)
    const readmeConnectedTo = new Set(readmeConns.map(c => c.to));
    for (const m of readme.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const target = m[2].trim();
      if (target.startsWith('http') || target.startsWith('#') || target.startsWith('/')) continue;
      if (target.match(/\.(png|jpg|jpeg|gif|svg|webp|md)$/i)) continue;
      if (readmeConnectedTo.has(target)) continue;
      readmeConns.push({ to: target, type: 'references', description: m[1], source: 'inline' });
      readmeConnectedTo.add(target);
    }

    const html = renderSafeMarkdown(readme);
    nodes.push({
      id: 'readme', title: 'README', cluster: 'docs',
      content: html, rawContent: readme, emoji: 'Document',
      parent: 'repo-root',
      identity: 'urn:content:readme',
      connections: readmeConns, source: { type: 'readme' },
    });
  }

  // Split issues with 2+ headings into parent + section nodes
  const expandedIssues: KBNode[] = [];
  for (const node of issueNodes) {
    const sectionNodes = splitIntoSections(
      node.id, node.title, node.rawContent, node.cluster, node.emoji ?? 'Pin',
      node.source, [...issueNodes, ...dirNodes],
    );
    if (sectionNodes.length > 0) {
      // Replace flat issue with parent + sections
      const idx = nodes.indexOf(node);
      if (idx >= 0) nodes.splice(idx, 1);
      expandedIssues.push(...sectionNodes);
    }
  }
  nodes.push(...expandedIssues);

  // Auto-link: issues → directories mentioned in their body
  const dirNames = dirNodes.map(d => d.title.replace(/\/$/, '')); // e.g. "src", "public"
  for (const node of issueNodes) {
    for (let i = 0; i < dirNames.length; i++) {
      const dir = dirNames[i];
      if (node.rawContent && (
        node.rawContent.includes(`${dir}/`) ||
        node.rawContent.includes(`\`${dir}\``) ||
        node.rawContent.toLowerCase().includes(dir.toLowerCase())
      )) {
        node.connections.push({ to: dirNodes[i].id, type: 'references', description: `References ${dir}/`, source: 'inferred' });
      }
    }
  }

  return nodes;
}

/** Try to load config.yaml from the repo. Falls back to DEFAULT_CONFIG. */
export async function loadConfig(source: SourceConfig): Promise<KBConfig> {
  try {
    const raw = await fetchFile(source, source.path
      ? `${source.path}/config.yaml`
      : 'content/config.yaml'
    );
    const parsed = yaml.parse(raw) as Partial<KBConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, source };
  } catch {
    return { ...DEFAULT_CONFIG, source };
  }
}