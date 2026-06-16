#!/usr/bin/env node
/**
 * Probe the FULL resolved graph (not the 40-node filtered HUD view) by
 * reading window.__kbeGraph (exposed by useKnowledgeBase). Reports
 * cluster distribution, connected components, BFS reachability from a
 * chosen start node, and the per-cluster degree-0 list.
 *
 * Run: node scripts/probe-full-graph.mjs [--url ...] [--start home]
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const baseUrl = arg('--url', 'http://localhost:4178');
const startNode = arg('--start', 'home');
const limitPerSection = Number(arg('--limit', '40'));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('requestfailed', (r) => {
  const err = r.failure()?.errorText || '';
  if (err.includes('ERR_NAME_NOT_RESOLVED') || err.includes('NS_ERROR')) return; // skip wikipedia offline noise
  console.error('[reqfail]', r.url().slice(0, 100), err);
});

console.log(`opening ${baseUrl}/#/node/${startNode}`);
await page.goto(`${baseUrl}/#/node/${startNode}`, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForFunction(() => !!window.__kbeGraph && window.__kbeGraph.graph.nodes.length > 0, { timeout: 30_000 });
await page.waitForTimeout(1500);

const data = await page.evaluate(() => {
  const g = window.__kbeGraph?.graph;
  if (!g) return null;
  return {
    mode: window.__kbeGraph.mode,
    nodes: g.nodes.map((n) => ({
      id: n.id, title: n.title || '', cluster: n.cluster || '(unset)', kind: n.kind || n.source?.type || '',
    })),
    edges: g.edges.map((e) => ({ from: e.from, to: e.to, type: e.type || '', source: e.source || '' })),
    clusters: g.clusters.map((c) => ({ id: c.id, name: c.name || '', color: c.color || '' })),
  };
});

if (!data) { console.error('window.__kbeGraph missing'); process.exit(2); }

console.log(`\n# Full resolved graph (${data.mode} mode)`);
console.log(`  ${data.nodes.length} nodes · ${data.edges.length} edges · ${data.clusters.length} clusters`);

// Adjacency.
const adj = new Map();
for (const n of data.nodes) adj.set(n.id, new Set());
for (const e of data.edges) {
  if (adj.has(e.from)) adj.get(e.from).add(e.to);
  if (adj.has(e.to)) adj.get(e.to).add(e.from);
}

// Cluster breakdown.
const clusters = new Map();
for (const n of data.nodes) clusters.set(n.cluster, (clusters.get(n.cluster) || 0) + 1);
console.log(`\n# Cluster distribution (${clusters.size})`);
for (const [c, n] of [...clusters.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${c}`);
}

// Connected components.
const seen = new Set();
const comps = [];
for (const n of data.nodes) {
  if (seen.has(n.id)) continue;
  const c = [];
  const q = [n.id];
  seen.add(n.id);
  while (q.length) {
    const u = q.shift();
    c.push(u);
    for (const v of adj.get(u) || []) if (!seen.has(v)) { seen.add(v); q.push(v); }
  }
  comps.push(c);
}
comps.sort((a, b) => b.length - a.length);
const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

console.log(`\n# Connected components: ${comps.length}`);
const smalls = comps.filter((c) => c.length < 5);
const big = comps.filter((c) => c.length >= 5);
console.log(`  ${big.length} component(s) ≥ 5 nodes:`);
big.slice(0, 8).forEach((c, i) => {
  const clusterMix = new Map();
  for (const id of c) {
    const k = nodeById.get(id)?.cluster || '?';
    clusterMix.set(k, (clusterMix.get(k) || 0) + 1);
  }
  const mix = [...clusterMix.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`    #${i + 1} size ${c.length}  [${mix}]`);
});
console.log(`  ${smalls.length} small component(s) (< 5 nodes) — likely orphans/fragments`);

// BFS reachability from start.
let reached = new Set();
if (adj.has(startNode)) {
  reached.add(startNode);
  const q = [startNode];
  while (q.length) {
    const u = q.shift();
    for (const v of adj.get(u) || []) if (!reached.has(v)) { reached.add(v); q.push(v); }
  }
} else {
  console.log(`\n  start='${startNode}' not in graph — reachability skipped`);
}
const unreached = data.nodes.filter((n) => !reached.has(n.id));
const degree0 = data.nodes.filter((n) => (adj.get(n.id)?.size || 0) === 0);
console.log(`\n# Unreached from '${startNode}': ${unreached.length} / ${data.nodes.length}`);
console.log(`# Degree-0 (literally zero edges): ${degree0.length}`);

if (degree0.length) {
  console.log(`\n# Degree-0 nodes by cluster:`);
  const byCluster = new Map();
  for (const n of degree0) {
    if (!byCluster.has(n.cluster)) byCluster.set(n.cluster, []);
    byCluster.get(n.cluster).push(n);
  }
  for (const [c, list] of [...byCluster.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${c}: ${list.length}`);
    list.slice(0, limitPerSection).forEach((n) => console.log(`    - ${n.id} "${n.title}"`));
    if (list.length > limitPerSection) console.log(`    … and ${list.length - limitPerSection} more`);
  }
}

if (smalls.length) {
  console.log(`\n# Small components (< 5 nodes) — sample first ${Math.min(limitPerSection, smalls.length)}:`);
  smalls.slice(0, limitPerSection).forEach((c) => {
    const labels = c.map((id) => {
      const n = nodeById.get(id);
      return `${id}[${n?.cluster ?? '?'}]`;
    }).join(', ');
    console.log(`  size ${c.length}: ${labels}`);
  });
}

if (unreached.length && unreached.length !== degree0.length) {
  console.log(`\n# Unreached-but-not-degree-0 (in isolated subgraphs reachable internally):`);
  const subgraphOnly = unreached.filter((n) => (adj.get(n.id)?.size || 0) > 0);
  const groupedByCluster = new Map();
  for (const n of subgraphOnly) {
    if (!groupedByCluster.has(n.cluster)) groupedByCluster.set(n.cluster, []);
    groupedByCluster.get(n.cluster).push(n);
  }
  for (const [c, list] of [...groupedByCluster.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${c}: ${list.length}`);
    list.slice(0, 10).forEach((n) => console.log(`    - ${n.id} "${n.title}"`));
    if (list.length > 10) console.log(`    … and ${list.length - 10} more`);
  }
}

await browser.close();
