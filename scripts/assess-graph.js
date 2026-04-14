#!/usr/bin/env node

/**
 * Graph quality assessment script for kbexplorer.
 *
 * Evaluates the content graph against readability and structural constraints,
 * computes quality scores, and produces actionable suggestions.
 *
 * Always exits 0 — this is a quality tool, not a gate.
 */

import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import yaml from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbRoot = resolve(__dirname, '..');
const contentDir = resolve(kbRoot, 'content');

// ── Limits ─────────────────────────────────────────────────

const LIMITS = {
  nodesPerView: 40,
  edgesPerView: 80,
  maxClusters: 8,
  maxHubHops: 3,
  highOutDegree: 15,
};

// ── Helpers ────────────────────────────────────────────────

function log(msg) {
  console.log(`[assess] ${msg}`);
}

/** Minimal frontmatter parser — splits `---` fenced YAML from body. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  try {
    return { meta: yaml.parse(match[1]) || {}, body: match[2] };
  } catch {
    return { meta: {}, body: raw };
  }
}

/** Strip fenced code blocks and inline code spans. */
function stripCode(body) {
  let stripped = body.replace(/```[\s\S]*?```/g, '');
  stripped = stripped.replace(/`[^`]+`/g, '');
  return stripped;
}

/** Extract all `[text](target)` inline links, ignoring external URLs and anchors. */
function extractInlineLinks(body) {
  const clean = stripCode(body);
  const links = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const target = m[2];
    if (target.startsWith('http://') || target.startsWith('https://')) continue;
    if (target.startsWith('#')) continue;
    if (target.startsWith('mailto:')) continue;
    links.push(target);
  }
  return links;
}

/** BFS from a start node, returning a Map of node → hop distance. */
function bfsDistances(adjacency, startId) {
  const distances = new Map();
  distances.set(startId, 0);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift();
    const d = distances.get(current);
    for (const neighbour of adjacency.get(current) || []) {
      if (!distances.has(neighbour)) {
        distances.set(neighbour, d + 1);
        queue.push(neighbour);
      }
    }
  }
  return distances;
}

/** Clamp a value to 0–100. */
function clamp100(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── Load data ──────────────────────────────────────────────

if (!existsSync(contentDir)) {
  log('No content/ directory found — nothing to assess.');
  process.exit(0);
}

const parsedContent = [];
for (const entry of readdirSync(contentDir)) {
  if (extname(entry) !== '.md') continue;
  const raw = readFileSync(resolve(contentDir, entry), 'utf-8');
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.id) continue;
  const links = extractInlineLinks(body);
  parsedContent.push({ file: entry, id: meta.id, title: meta.title || meta.id, cluster: meta.cluster || null, body, links });
}

const nodeIds = new Set(parsedContent.map((c) => c.id));

// Build edges (only to known nodes)
const edges = [];
for (const c of parsedContent) {
  for (const target of c.links) {
    if (nodeIds.has(target)) {
      edges.push({ from: c.id, to: target });
    }
  }
}

// Read config for cluster definitions
let config = {};
const configPath = resolve(contentDir, 'config.yaml');
if (existsSync(configPath)) {
  config = yaml.parse(readFileSync(configPath, 'utf-8')) || {};
}

// Build cluster membership
const clusterMap = new Map(); // cluster → [nodeId]
for (const c of parsedContent) {
  if (c.cluster) {
    if (!clusterMap.has(c.cluster)) clusterMap.set(c.cluster, []);
    clusterMap.get(c.cluster).push(c.id);
  }
}

const nodeCount = parsedContent.length;
const edgeCount = edges.length;
const clusterCount = clusterMap.size;

log(`Loading ${nodeCount} content nodes...`);
log(`Graph: ${nodeCount} nodes, ${edgeCount} edges, ${clusterCount} clusters`);
log('');

// ── Adjacency structures ──────────────────────────────────

const outDegree = new Map();
const inDegree = new Map();
// Undirected adjacency for BFS reachability
const adjacency = new Map();

for (const id of nodeIds) {
  outDegree.set(id, 0);
  inDegree.set(id, 0);
  adjacency.set(id, new Set());
}
for (const e of edges) {
  outDegree.set(e.from, (outDegree.get(e.from) || 0) + 1);
  inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  adjacency.get(e.from).add(e.to);
  adjacency.get(e.to).add(e.from);
}

// ── Constraint checks ─────────────────────────────────────

log('── Constraints ──');

// Node count per view layer
if (nodeCount <= LIMITS.nodesPerView) {
  log(`✅ Node count: ${nodeCount} (limit: ${LIMITS.nodesPerView})`);
} else {
  log(`⚠️  Node count: ${nodeCount} exceeds ${LIMITS.nodesPerView}-node readability limit — use layer views`);
}

// Edge count per view layer
if (edgeCount <= LIMITS.edgesPerView) {
  log(`✅ Edge count: ${edgeCount} (limit: ${LIMITS.edgesPerView})`);
} else {
  log(`⚠️  Edge count: ${edgeCount} exceeds ${LIMITS.edgesPerView}-edge readability limit — use layer views`);
}

// Cluster count
if (clusterCount <= LIMITS.maxClusters) {
  log(`✅ Clusters: ${clusterCount} (limit: ${LIMITS.maxClusters})`);
} else {
  log(`❌ Clusters: ${clusterCount} exceeds limit of ${LIMITS.maxClusters}`);
}

// Orphan nodes (zero incoming links)
const orphans = [];
for (const c of parsedContent) {
  if ((inDegree.get(c.id) || 0) === 0) {
    orphans.push(c.id);
  }
}
if (orphans.length === 0) {
  log('✅ No orphan nodes');
} else {
  log(`⚠️  ${orphans.length} orphan node(s) with 0 incoming links: ${orphans.join(', ')}`);
}

// Hub reachability — find hub (highest total degree), BFS, check max hops
let hubId = parsedContent[0]?.id;
let hubDegree = 0;
for (const c of parsedContent) {
  const total = (outDegree.get(c.id) || 0) + (inDegree.get(c.id) || 0);
  if (total > hubDegree) {
    hubDegree = total;
    hubId = c.id;
  }
}

const distances = bfsDistances(adjacency, hubId);
let maxHops = 0;
const unreachable = [];
for (const id of nodeIds) {
  if (!distances.has(id)) {
    unreachable.push(id);
  } else {
    maxHops = Math.max(maxHops, distances.get(id));
  }
}

if (unreachable.length > 0) {
  log(`❌ Hub reachability: ${unreachable.length} node(s) unreachable from hub "${hubId}"`);
} else if (maxHops <= LIMITS.maxHubHops) {
  log(`✅ Hub reachability: all within ${maxHops} hops of hub "${hubId}"`);
} else {
  log(`⚠️  Hub reachability: max ${maxHops} hops from hub "${hubId}" (target: ≤${LIMITS.maxHubHops})`);
}

// ── Quality scores ─────────────────────────────────────────

log('');
log('── Quality Scores ──');

// 1. Connectivity — avg links per node, target 4-8
const avgLinks = nodeCount > 0 ? edgeCount / nodeCount : 0;
let connectivityScore;
if (avgLinks >= 4 && avgLinks <= 8) {
  connectivityScore = 100;
} else if (avgLinks < 4) {
  connectivityScore = clamp100((avgLinks / 4) * 100);
} else {
  // Diminish above 8, hitting 50 at 16
  connectivityScore = clamp100(100 - ((avgLinks - 8) / 8) * 50);
}
log(`Connectivity:     ${connectivityScore}/100 (avg ${avgLinks.toFixed(1)} links/node)`);

// 2. Cluster balance — std deviation of cluster sizes
const clusterSizes = [...clusterMap.values()].map((arr) => arr.length);
let clusterBalanceScore = 100;
if (clusterSizes.length > 1) {
  const mean = clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length;
  const variance = clusterSizes.reduce((s, v) => s + (v - mean) ** 2, 0) / clusterSizes.length;
  const stdDev = Math.sqrt(variance);
  // Perfect balance = 0 stddev → 100. Score drops as stddev rises.
  clusterBalanceScore = clamp100(100 - stdDev * 15);
  log(`Cluster balance:  ${clusterBalanceScore}/100 (σ = ${stdDev.toFixed(1)} nodes)`);
} else {
  log(`Cluster balance:  N/A (${clusterSizes.length} cluster)`);
}

// 3. Link density — edges / max-possible-edges
const maxEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 1;
const density = edgeCount / maxEdges;
// Ideal density for a readable graph is around 0.1-0.3
let densityScore;
if (density >= 0.1 && density <= 0.3) {
  densityScore = 100;
} else if (density < 0.1) {
  densityScore = clamp100((density / 0.1) * 100);
} else {
  densityScore = clamp100(100 - ((density - 0.3) / 0.7) * 100);
}
log(`Link density:     ${densityScore}/100 (${density.toFixed(2)})`);

// 4. Bidirectionality — % of edges with a reverse edge
const edgeSet = new Set(edges.map((e) => `${e.from}→${e.to}`));
let reciprocalCount = 0;
for (const e of edges) {
  if (edgeSet.has(`${e.to}→${e.from}`)) reciprocalCount++;
}
const bidirPct = edgeCount > 0 ? (reciprocalCount / edgeCount) * 100 : 0;
const bidirScore = clamp100(bidirPct);
log(`Bidirectionality: ${bidirScore}/100 (${Math.round(bidirPct)}% reciprocal)`);

// 5. Content depth — avg content length per node
const avgContentLen = nodeCount > 0
  ? parsedContent.reduce((sum, c) => sum + c.body.length, 0) / nodeCount
  : 0;
// Target: ~1000 chars. Score 100 at 1000+, linear ramp below.
const depthScore = clamp100((avgContentLen / 1000) * 100);
log(`Content depth:    ${depthScore}/100 (avg ${Math.round(avgContentLen).toLocaleString()} chars)`);

// ── Suggestions ────────────────────────────────────────────

log('');
log('── Suggestions ──');
const suggestions = [];

// Orphan nodes
for (const id of orphans) {
  suggestions.push(`Node "${id}" has 0 incoming links — add a reference from a parent node`);
}

// Oversized clusters
for (const [cluster, members] of clusterMap) {
  if (members.length > LIMITS.maxClusters + 1) {
    suggestions.push(`Cluster "${cluster}" has ${members.length} nodes — consider splitting into sub-clusters`);
  }
}

// High out-degree nodes
for (const c of parsedContent) {
  const out = outDegree.get(c.id) || 0;
  if (out >= LIMITS.highOutDegree) {
    suggestions.push(`Node "${c.id}" has ${out} outgoing links — consider splitting into focused sub-nodes`);
  }
}

// Duplicate titles
const titleMap = new Map();
for (const c of parsedContent) {
  const t = (c.title || '').toLowerCase();
  if (!titleMap.has(t)) titleMap.set(t, []);
  titleMap.get(t).push(c.id);
}
for (const [title, ids] of titleMap) {
  if (ids.length > 1) {
    suggestions.push(`Nodes ${ids.join(' and ')} have identical title "${title}" — possible duplicate`);
  }
}

// Edge count warning
if (edgeCount > LIMITS.edgesPerView) {
  suggestions.push(`Edge count ${edgeCount} exceeds ${LIMITS.edgesPerView}-edge readability limit — use layer views`);
}

// Node count warning
if (nodeCount > LIMITS.nodesPerView) {
  suggestions.push(`Node count ${nodeCount} exceeds ${LIMITS.nodesPerView}-node readability limit — use layer views`);
}

if (suggestions.length === 0) {
  log('No suggestions — graph looks great!');
} else {
  for (let i = 0; i < suggestions.length; i++) {
    log(`${i + 1}. ${suggestions[i]}`);
  }
}

log('');
log(`Assessment complete. ${suggestions.length} suggestion(s).`);
process.exit(0);
