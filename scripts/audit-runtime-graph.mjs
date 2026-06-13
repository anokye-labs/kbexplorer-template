#!/usr/bin/env node

/**
 * Runtime graph audit — what the actual deployed app produces.
 *
 * Existing assess-graph.js only inspects authored md in content/. The runtime
 * graph the user sees is much larger because it includes issues, PRs, commits,
 * branches, structural .github files, content-model entities and more.
 *
 * This loads the full runtime graph the same way the app does (via vite +
 * VITE_KB_LOCAL=true and a headless Node import of the engine) and reports the
 * sensemaking metrics. Run after `node scripts/generate-manifest.js`.
 *
 * Usage: node scripts/audit-runtime-graph.mjs [--fail-on=ISSUE_ID,...]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbRoot = resolve(__dirname, '..');

const manifestPath = resolve(kbRoot, 'src', 'generated', 'repo-manifest.json');
if (!existsSync(manifestPath)) {
  console.error('[audit] repo-manifest.json missing — run `node scripts/generate-manifest.js` first');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

const configPath = resolve(kbRoot, 'content', 'config.yaml');
const config = existsSync(configPath) ? yaml.parse(readFileSync(configPath, 'utf-8')) || {} : {};

// ── Build a representative runtime graph from the manifest ──
//
// This is intentionally a duplicate of work-provider / structural-provider /
// parser logic — we want the audit to be a black-box check that catches drift
// even if the runtime providers change. The numbers will be approximate but
// directionally correct; the goal is to flag sensemaking issues, not exact
// renderer parity.

const nodes = new Map(); // id → { id, cluster, edges: Set<string>, kind }

function addNode(id, cluster, kind = 'other') {
  if (!nodes.has(id)) nodes.set(id, { id, cluster, kind, edges: new Set() });
}
function addEdge(from, to) {
  if (!from || !to) return;
  if (from === to) return;
  // We don't require both endpoints to exist — that itself is a finding
  if (!nodes.has(from)) addNode(from, 'unknown', 'phantom');
  if (!nodes.has(to)) addNode(to, 'unknown', 'phantom');
  nodes.get(from).edges.add(to);
  nodes.get(to).edges.add(from);
}

// Pre-compute the valid issue/PR sets so we can filter phantom #N refs.
// (The fixed providers do the same — phantom #NNN edges to nonexistent
// issues/PRs are dropped instead of inflating the graph.)
const validIssueNumbers = new Set();
const validPrNumbers = new Set();
for (const iss of manifest.issues ?? []) {
  validIssueNumbers.add(iss.number);
}
for (const pr of manifest.pullRequests ?? []) {
  validPrNumbers.add(pr.number);
}

// Issues — every issue is `tracked-in` repo-meta and shares the `work` cluster
for (const iss of manifest.issues ?? []) {
  addNode(`issue-${iss.number}`, 'work', 'issue');
  for (const m of (iss.body ?? '').matchAll(/#(\d+)/g)) {
    const n = Number(m[1]);
    if (n === iss.number) continue;
    if (validIssueNumbers.has(n)) addEdge(`issue-${iss.number}`, `issue-${n}`);
    else if (validPrNumbers.has(n)) addEdge(`issue-${iss.number}`, `pr-${n}`);
  }
  // Typed edge to the repository
  if (manifest.repoMetadata) addEdge(`issue-${iss.number}`, 'repo-meta');
}

// PRs — same cluster as before (`pull-request`), tracked-in repo-meta
for (const pr of manifest.pullRequests ?? []) {
  addNode(`pr-${pr.number}`, 'pull-request', 'pr');
  for (const m of (pr.body ?? '').matchAll(/#(\d+)/g)) {
    const n = Number(m[1]);
    if (n === pr.number) continue;
    if (validIssueNumbers.has(n)) addEdge(`pr-${pr.number}`, `issue-${n}`);
    else if (validPrNumbers.has(n)) addEdge(`pr-${pr.number}`, `pr-${n}`);
  }
  if (pr.head_branch) addEdge(`pr-${pr.number}`, `branch-${pr.head_branch}`);
  if (manifest.repoMetadata) addEdge(`pr-${pr.number}`, 'repo-meta');
}

// Branches — every branch is tracked-in repo-meta (was: default-only)
for (const b of manifest.branches ?? []) {
  addNode(`branch-${b.name}`, 'infra', 'branch');
  if (manifest.repoMetadata) addEdge(`branch-${b.name}`, 'repo-meta');
}

// Repo metadata — links to readme, default branch, AND repo-root (was missing)
if (manifest.repoMetadata) {
  addNode('repo-meta', 'infra', 'repo-meta');
  addEdge('repo-meta', 'readme');
  addEdge('repo-meta', `branch-${manifest.repoMetadata.default_branch}`);
  addEdge('repo-meta', 'repo-root');
}

// Commits — single summary node, also tracked-in repo-meta
if ((manifest.commits ?? []).length > 0) {
  addNode('commits', 'commits', 'commits');
  if (manifest.repoMetadata) addEdge('commits', 'repo-meta');
  for (const c of manifest.commits) {
    for (const m of (c.commit?.message ?? '').matchAll(/#(\d+)/g)) {
      const n = Number(m[1]);
      if (validIssueNumbers.has(n)) addEdge('commits', `issue-${n}`);
      else if (validPrNumbers.has(n)) addEdge('commits', `pr-${n}`);
    }
  }
}

// Tree → repo-root + dir-* + file-*
addNode('repo-root', 'code', 'file-root');
const dirs = new Set();
for (const item of manifest.tree ?? []) {
  if (item.type !== 'blob' || item.path.startsWith('.')) continue;
  const parts = item.path.split('/');
  if (parts[0].startsWith('.')) continue;
  if (parts.length > 1) {
    dirs.add(parts.slice(0, Math.min(2, parts.length - 1)).join('/'));
  }
}
for (const dir of dirs) {
  const id = `dir-${dir}`;
  addNode(id, 'code', 'dir');
  const depth = dir.split('/').length;
  if (depth === 1) {
    addEdge(id, 'repo-root');
  } else {
    const parentDir = dir.split('/')[0];
    // Ensure the parent dir node exists so we don't strand the subdir
    addNode(`dir-${parentDir}`, 'code', 'dir');
    addEdge(`dir-${parentDir}`, 'repo-root');
    addEdge(id, `dir-${parentDir}`);
  }
}
// README
if (manifest.readme) {
  addNode('readme', 'docs', 'readme');
  addEdge('readme', 'repo-root');
}

// Authored content
for (const c of manifest.content ?? []) {
  const match = c.raw?.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) continue;
  const meta = yaml.parse(match[1]) || {};
  if (!meta.id) continue;
  addNode(meta.id, meta.cluster ?? 'uncategorized', 'authored');
}

// Structural .github files → repo-meta
for (const path of Object.keys(manifest.structural ?? {})) {
  const safe = path.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  addNode(`gh-${safe}`, 'infra', 'structural');
  addEdge(`gh-${safe}`, 'repo-meta');
}

// ── Compute metrics ──
const allNodes = [...nodes.values()];
const clusterCounts = new Map();
for (const n of allNodes) {
  clusterCounts.set(n.cluster, (clusterCounts.get(n.cluster) || 0) + 1);
}

const degrees = new Map(allNodes.map(n => [n.id, n.edges.size]));
const orphans = allNodes.filter(n => n.edges.size === 0 && n.kind !== 'phantom');

// Issues without a typed edge to repo (only have weak inferred edges)
const repoTargets = new Set(['repo-meta', 'repo-root']);
const issuesByRepoCxn = { linked: 0, unlinked: 0 };
for (const n of allNodes) {
  if (n.kind !== 'issue') continue;
  const hasRepoEdge = [...n.edges].some(e => repoTargets.has(e));
  if (hasRepoEdge) issuesByRepoCxn.linked++; else issuesByRepoCxn.unlinked++;
}
const prsByRepoCxn = { linked: 0, unlinked: 0 };
for (const n of allNodes) {
  if (n.kind !== 'pr') continue;
  const hasRepoEdge = [...n.edges].some(e => repoTargets.has(e));
  if (hasRepoEdge) prsByRepoCxn.linked++; else prsByRepoCxn.unlinked++;
}

// repo-meta ↔ repo-root linkage
const repoMetaEdges = nodes.get('repo-meta')?.edges ?? new Set();
const repoRootEdges = nodes.get('repo-root')?.edges ?? new Set();
const repoMetaRepoRootLinked = repoMetaEdges.has('repo-root');

// Hub reachability (BFS from highest-degree node)
let hub = allNodes[0]?.id;
let hubDeg = 0;
for (const [id, d] of degrees) {
  if (d > hubDeg) { hubDeg = d; hub = id; }
}
const dist = new Map([[hub, 0]]);
const queue = [hub];
while (queue.length) {
  const cur = queue.shift();
  const d = dist.get(cur);
  for (const n of nodes.get(cur)?.edges ?? []) {
    if (!dist.has(n)) { dist.set(n, d + 1); queue.push(n); }
  }
}
const unreachable = allNodes.filter(n => !dist.has(n.id) && n.kind !== 'phantom');
const farReach = allNodes.filter(n => (dist.get(n.id) ?? 99) > 3 && n.kind !== 'phantom');

// Cluster proliferation
const tinyClusters = [...clusterCounts.entries()].filter(([, c]) => c <= 2);
const sortedClusters = [...clusterCounts.entries()].sort((a, b) => b[1] - a[1]);

// Empty-label nodes (degree < 2 and not key)
const lowDegreeNodes = allNodes.filter(n => degrees.get(n.id) < 2 && n.kind !== 'phantom');

// ── Report ──
const findings = [];
function add(id, severity, message, detail = '') {
  findings.push({ id, severity, message, detail });
}

console.log(`[audit] Runtime graph (from manifest):`);
console.log(`        ${allNodes.length} nodes · ${[...degrees.values()].reduce((a, b) => a + b, 0) / 2} unique edges · ${clusterCounts.size} clusters`);
console.log(`        Hub: ${hub} (deg ${hubDeg})`);
console.log('');

if (clusterCounts.size > 8) {
  add('cluster-proliferation', 'high',
    `${clusterCounts.size} clusters exceeds 8-cluster sensemaking limit`,
    `top: ${sortedClusters.slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ')}`);
}

if (tinyClusters.length > 0) {
  add('tiny-clusters', 'medium',
    `${tinyClusters.length} clusters have ≤2 nodes (visual noise)`,
    tinyClusters.map(([k, c]) => `${k}(${c})`).join(', '));
}

if (issuesByRepoCxn.unlinked > 0) {
  add('issues-not-linked-to-repo', 'high',
    `${issuesByRepoCxn.unlinked} of ${issuesByRepoCxn.linked + issuesByRepoCxn.unlinked} issues lack a typed edge to repo-meta or repo-root`,
    `issues should belong-to / be tracked-in the repository node`);
}

if (prsByRepoCxn.unlinked > 0) {
  add('prs-not-linked-to-repo', 'high',
    `${prsByRepoCxn.unlinked} of ${prsByRepoCxn.linked + prsByRepoCxn.unlinked} PRs lack a typed edge to repo-meta or repo-root`,
    `PRs should belong-to the repository node`);
}

if (!repoMetaRepoRootLinked && nodes.has('repo-meta') && nodes.has('repo-root')) {
  add('repo-meta-repo-root-disconnected', 'high',
    `repo-meta and repo-root are not connected to each other`,
    `they describe the same repository — the file tree and the GitHub repo`);
}

if (unreachable.length > 0) {
  add('unreachable-from-hub', 'high',
    `${unreachable.length} nodes are unreachable from hub "${hub}"`);
}

if (farReach.length > allNodes.length * 0.1) {
  add('far-from-hub', 'medium',
    `${farReach.length} nodes are > 3 hops from hub "${hub}" (target: < 10%)`);
}

if (lowDegreeNodes.length > allNodes.length * 0.3) {
  add('many-low-degree-nodes', 'medium',
    `${lowDegreeNodes.length} of ${allNodes.length} nodes have degree < 2 — they'll render as unlabelled circles`);
}

if (orphans.length > 0) {
  add('genuine-orphans', 'high',
    `${orphans.length} truly orphan nodes (will be force-attached at render time)`);
}

// Print findings
if (findings.length === 0) {
  console.log('[audit] ✅ All sensemaking checks passed');
  process.exit(0);
}

const high = findings.filter(f => f.severity === 'high');
const med = findings.filter(f => f.severity === 'medium');

if (high.length) {
  console.log('── HIGH severity ───────────────────────────────');
  for (const f of high) console.log(`  ❌ [${f.id}] ${f.message}\n     ${f.detail}`);
  console.log('');
}
if (med.length) {
  console.log('── MEDIUM severity ─────────────────────────────');
  for (const f of med) console.log(`  ⚠️  [${f.id}] ${f.message}\n     ${f.detail}`);
  console.log('');
}

// CLI exit code
const failOn = (process.argv.find(a => a.startsWith('--fail-on=')) ?? '').slice('--fail-on='.length).split(',').filter(Boolean);
const triggered = findings.filter(f => failOn.includes(f.id));
if (failOn.length > 0 && triggered.length > 0) {
  console.error(`[audit] Failed on: ${triggered.map(f => f.id).join(', ')}`);
  process.exit(1);
}
process.exit(0);
