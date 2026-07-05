/**
 * Local content loader for kbexplorer.
 *
 * In local mode, imports the pre-built repo-manifest.json and produces the same
 * KBNode[] and KBConfig as the API-based parser — but with zero runtime API calls.
 */
import yaml from 'yaml';
import { renderSafeMarkdown } from './safe-markdown';
import type { KBNode, KBConfig, KBGraph } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { assignIdentity } from './identity';
import {
  parseMarkdownFile,
  issueToNode,
  treeToNodes,
  buildGraph,
  extractIssueRefs,
  splitIntoSections,
} from '../engine';
import { ManifestSource } from './sources/manifest-source';
import { loadKnowledgeBase } from './loader';
import type { GHTreeItem } from '../api';
import type { EngineEnv } from './env';
import type { RepoManifest } from '@anokye-labs/kbexplorer-engine/sources';
import { browserWasmLocateFile } from './store/browser-wasm';

// ── Manifest Types ─────────────────────────────────────────

/**
 * `RepoManifest` was relocated to `@anokye-labs/kbexplorer-engine`'s
 * `./sources` subpath in anokye-labs/kbexplorer-template#472, slice 4/5
 * STEP B, because `ManifestSource`'s constructor (also moved) takes one.
 * The manifest-generation script and this local (manifest-import) loader
 * remain template-side; only the interface itself travels — re-exported
 * here (thin re-export idiom, same as `access.ts`/`NodeLayer`) so every
 * existing template import path (`'../local-loader'` /
 * `'../../src/engine/local-loader'`) keeps resolving unchanged.
 */
export type { RepoManifest };

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
export function isLocalMode(env?: EngineEnv): boolean {
  return env?.VITE_KB_LOCAL === 'true';
}

/** Async check — same as isLocalMode but async for hook compatibility. */
export async function detectLocalMode(env?: EngineEnv): Promise<boolean> {
  return isLocalMode(env);
}

// ── Local Config ───────────────────────────────────────────

/** Derive the resolved KBConfig from an in-memory manifest (pure; no I/O). */
export function buildConfigFromManifest(manifest: RepoManifest | null): KBConfig {
  if (!manifest?.configRaw) return { ...DEFAULT_CONFIG };

  try {
    const parsed = yaml.parse(manifest.configRaw) as Partial<KBConfig>;
    const config = { ...DEFAULT_CONFIG, ...parsed, source: DEFAULT_CONFIG.source };
    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function loadLocalConfig(): Promise<KBConfig> {
  return buildConfigFromManifest(await loadManifest());
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
  const issueNodes = manifest.issues.map(issue => issueToNode(issue));

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

    const html = renderSafeMarkdown(readme);
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
    const html = renderSafeMarkdown(body);
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
    const commitHtml = renderSafeMarkdown(commitContent);
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

/**
 * Provider-based loader using the orchestrator pipeline.
 *
 * 1. Registers FilesProvider, AuthoredProvider, WorkProvider
 * 2. Collects nodes from providers in dependency order
 * 3. Applies README creation + cross-linking transforms not yet in providers
 * 4. Builds the final graph
 */
async function loadLocalKnowledgeBaseV2(env?: EngineEnv): Promise<{
  graph: KBGraph;
  config: KBConfig;
  themeFileRaw: string | null;
}> {
  const manifest = await loadManifest();
  if (!manifest) {
    const config = await loadLocalConfig();
    const graph = buildGraph([], []);
    return { graph, config, themeFileRaw: null };
  }

  const config = buildConfigFromManifest(manifest);
  return buildKnowledgeBaseFromManifest(manifest, config, env);
}

/**
 * Build the local-mode KBGraph from an in-memory manifest + resolved config.
 * Extracted so a committed manifest fixture can drive a hermetic golden
 * snapshot (Phase 0) without depending on the ambient generated manifest.
 */
export async function buildKnowledgeBaseFromManifest(
  manifest: RepoManifest,
  config: KBConfig,
  env?: EngineEnv,
): Promise<{ graph: KBGraph; config: KBConfig; themeFileRaw: string | null }> {
  const result = await loadKnowledgeBase(
    new ManifestSource(manifest, config),
    config,
    env,
    {
      ...(typeof env?.BASE_URL === 'string' ? { importBaseUrl: env.BASE_URL } : {}),
      graphStore: { locateFile: browserWasmLocateFile },
    },
  );
  return { ...result, themeFileRaw: manifest.themeFileRaw ?? null };
}

export async function loadLocalKnowledgeBase(env?: EngineEnv): Promise<{
  graph: KBGraph;
  config: KBConfig;
  themeFileRaw: string | null;
}> {
  return loadLocalKnowledgeBaseV2(env);
}

// ── Legacy monolithic loader (kept as fallback reference) ──
//
// export async function loadLocalKnowledgeBase_legacy(): Promise<{
//   graph: KBGraph;
//   config: KBConfig;
//   themeFileRaw: string | null;
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
