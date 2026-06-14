#!/usr/bin/env node
/**
 * One-off probe: open the rendered MAP at /#/node/home, then ask the
 * vis-network instance for the FULL graph topology (not just visible
 * nodes), compute reachability from `home`, and dump every disconnected
 * cluster + the nodes inside it.
 *
 * Run: node scripts/probe-disconnected.mjs [--url http://localhost:4178]
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};

const baseUrl = arg('--url', 'http://localhost:4178');
const startNode = arg('--start', 'home');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') console.error(`[${t}]`, msg.text().slice(0, 300));
});
page.on('requestfailed', (r) => console.error('[reqfail]', r.url(), r.failure()?.errorText));

const url = `${baseUrl}/#/node/${startNode}`;
console.log(`opening ${url}`);

// Pre-seed localStorage so the HUD dock=right → sidebar graph auto-mounts
// with auditSlot='hud-sidebar'. Default dock is 'bottom' (no auto-mount).
await page.addInitScript(() => {
  try {
    localStorage.setItem('kbe-hud-dock', 'right');
    localStorage.setItem('kbe-sidebar-w', '40');
    localStorage.setItem('kbe-hud-collapsed', 'false');
  } catch { /* */ }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
await page.waitForTimeout(5000);

// Dump diagnostics on what's rendered so we can see why the slot isn't there.
const diag = await page.evaluate(() => ({
  bodyText: document.body.innerText.slice(0, 400),
  hudExists: !!document.querySelector('[class*="hud"], [class*="HUD"]'),
  canvasCount: document.querySelectorAll('canvas').length,
  netSlots: Object.keys(window.__kbeNetworks || {}),
  visNodeCount: (window.__kbeNetworks && window.__kbeNetworks['hud-sidebar']?.network?.body?.data?.nodes?.length) || 0,
  storage: { dock: localStorage.getItem('kbe-hud-dock'), w: localStorage.getItem('kbe-sidebar-w') },
}));
console.log('diag:', JSON.stringify(diag, null, 2));

await page.waitForFunction(() => window.__kbeNetworks && Object.keys(window.__kbeNetworks).length > 0, { timeout: 20_000 });
await page.waitForTimeout(2500);

const topology = await page.evaluate(() => {
  const out = { networks: {}, error: null };
  try {
    const nets = window.__kbeNetworks || {};
    for (const [slot, entry] of Object.entries(nets)) {
      const net = entry && entry.network ? entry.network : entry;
      if (!net || !net.body) continue;
      const nodes = net.body.data.nodes.get();
      const edges = net.body.data.edges.get();
      out.networks[slot] = {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.__auditLabel || n.label || '',
          cluster: n.cluster || n.group || '(unset)',
          kind: n.kind || n.shape || '(unset)',
        })),
        edges: edges.map((e) => ({ from: e.from, to: e.to, type: e.relation || e.kind || '' })),
      };
    }
  } catch (e) {
    out.error = String(e && e.stack || e);
  }
  return out;
});

if (topology.error) {
  console.error('probe error:', topology.error);
  process.exit(2);
}

const slots = Object.keys(topology.networks);
console.log(`networks exposed: ${slots.join(', ') || '(none)'}`);

for (const slot of slots) {
  const net = topology.networks[slot];
  console.log(`\n=== slot: ${slot} (${net.nodeCount} nodes, ${net.edgeCount} edges) ===`);

  // Build adjacency.
  const adj = new Map();
  for (const n of net.nodes) adj.set(n.id, new Set());
  for (const e of net.edges) {
    if (adj.has(e.from)) adj.get(e.from).add(e.to);
    if (adj.has(e.to)) adj.get(e.to).add(e.from);
  }

  // BFS from start node.
  const start = startNode;
  if (!adj.has(start)) {
    console.log(`  start node '${start}' not in this slot's graph; skipping reachability`);
    // Still report cluster distribution + degree zeros.
  }
  const reached = new Set();
  if (adj.has(start)) {
    const queue = [start];
    reached.add(start);
    while (queue.length) {
      const u = queue.shift();
      for (const v of adj.get(u) || []) {
        if (!reached.has(v)) { reached.add(v); queue.push(v); }
      }
    }
  }

  const unreached = net.nodes.filter((n) => !reached.has(n.id));
  const degree0 = net.nodes.filter((n) => (adj.get(n.id)?.size || 0) === 0);

  // Connected components.
  const seen = new Set();
  const components = [];
  for (const n of net.nodes) {
    if (seen.has(n.id)) continue;
    const comp = [];
    const q = [n.id];
    seen.add(n.id);
    while (q.length) {
      const u = q.shift();
      comp.push(u);
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) { seen.add(v); q.push(v); }
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);

  // Cluster distribution.
  const clusters = new Map();
  for (const n of net.nodes) {
    const c = n.cluster || '(unset)';
    clusters.set(c, (clusters.get(c) || 0) + 1);
  }
  const clusterSorted = [...clusters.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`  clusters (${clusters.size} distinct):`);
  for (const [c, n] of clusterSorted) console.log(`    ${c}: ${n}`);

  console.log(`  connected components: ${components.length}`);
  components.slice(0, 8).forEach((comp, i) => {
    const sample = comp.slice(0, 6).map((id) => {
      const node = net.nodes.find((n) => n.id === id);
      return node ? `${node.id}${node.label ? `(${node.label.slice(0,30)})` : ''}` : id;
    });
    console.log(`    component #${i + 1} (size ${comp.length}): ${sample.join(', ')}${comp.length > 6 ? ', …' : ''}`);
  });
  if (components.length > 8) console.log(`    … and ${components.length - 8} more components`);

  console.log(`  unreached from '${start}': ${unreached.length}`);
  if (unreached.length) {
    const head = unreached.slice(0, 30).map((n) => `${n.id}${n.label ? `(${n.label.slice(0,40)})` : ''}[${n.cluster}]`);
    head.forEach((s) => console.log(`    ${s}`));
    if (unreached.length > 30) console.log(`    … and ${unreached.length - 30} more`);
  }

  console.log(`  degree-0 (no edges at all): ${degree0.length}`);
  degree0.slice(0, 30).forEach((n) => console.log(`    ${n.id}${n.label ? `(${n.label.slice(0,40)})` : ''}[${n.cluster}]`));
  if (degree0.length > 30) console.log(`    … and ${degree0.length - 30} more`);
}

await browser.close();
