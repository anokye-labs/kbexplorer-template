#!/usr/bin/env node

/**
 * audit-visual.mjs — property-based visual audit of the rendered constellation.
 *
 * The structural audit (`audit-runtime-graph.mjs`) catches *data* regressions
 * in the manifest. This one catches *rendering* regressions in what the user
 * actually sees on the canvas: cluster legend explosion, faded edges,
 * unlabelled focus neighbours, the repo-meta hub going invisible.
 *
 * It is intentionally property-based, not pixel-based — no committed
 * baseline PNGs, no flaky pixel-diff thresholds. Each check is a small
 * assertion about a measurable visual property:
 *
 *   - hud-related-links       Repo-meta panel surfaces enough connected nodes
 *   - legend-cluster-count    MAP legend stays under the 8-cluster sensemaking
 *                             limit (catches label-as-cluster regression)
 *   - map-canvas-non-blank    Canvas actually rendered (smoke test)
 *   - map-edge-visibility     Edge pixels are bright enough to see on dark BG
 *                             (catches faded-edge-alpha regression)
 *   - map-label-coverage      A meaningful fraction of MAP nodes carry labels
 *                             (catches the "wall of mystery circles" regression)
 *   - focus-neighbour-labels  1-hop neighbours of the focused node are labelled
 *                             (catches the labelDegreeThreshold override
 *                             regression)
 *
 * Boot sequence
 * -------------
 * 1. (unless --skip-build) `node scripts/generate-manifest.js` then
 *    `vite build` with VITE_KB_LOCAL=true. No GitHub auth needed beyond
 *    what generate-manifest already uses (default GITHUB_TOKEN).
 * 2. Start vite preview, parse the actual bound port from its stdout.
 * 3. Launch headless chromium, run the checks, print a report.
 *
 * Usage
 * -----
 *   npm run audit:visual                         # builds + previews + audits
 *   npm run audit:visual:strict                  # same, fails CI on any HIGH
 *   node scripts/audit-visual.mjs --skip-build
 *   node scripts/audit-visual.mjs --base-url http://127.0.0.1:5173
 *   node scripts/audit-visual.mjs --fail-on=map-label-coverage,legend-cluster-count
 *
 * The script depends on `window.__kbeNetworks[slot]` being populated by
 * `createGraphNetwork` (slot = "map-overlay" for the MAP fullscreen, slot =
 * "hud-sidebar" for the dock graph). That hook is unconditional in the
 * engine — there is no production cost beyond the property assignment.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ── CLI args ─────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    skipBuild: false,
    baseUrl: null,
    failOn: new Set(),
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-build') opts.skipBuild = true;
    else if (a === '--base-url' && argv[i + 1]) opts.baseUrl = argv[++i];
    else if (a === '--verbose') opts.verbose = true;
    else if (a.startsWith('--fail-on=')) {
      for (const id of a.slice('--fail-on='.length).split(',')) {
        if (id.trim()) opts.failOn.add(id.trim());
      }
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

// ── Build + preview helpers ──────────────────────────────────

function viteBin() {
  return process.platform === 'win32'
    ? join(repoRoot, 'node_modules', '.bin', 'vite.cmd')
    : join(repoRoot, 'node_modules', '.bin', 'vite');
}

function runCmd(cmd, args, env) {
  return new Promise((res, rej) => {
    const proc = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...(env ?? {}) },
    });
    proc.on('close', code => code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`)));
    proc.on('error', rej);
  });
}

async function buildLocalMode() {
  console.log('[audit-visual] Building local-mode bundle…');
  await runCmd(process.execPath, ['scripts/generate-manifest.js']);
  await runCmd(viteBin(), ['build'], { VITE_KB_LOCAL: 'true' });
}

async function pollHttp(url, maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(url, r => { r.resume(); res(); });
        req.on('error', rej);
        req.setTimeout(1500, () => { req.destroy(); rej(new Error('timeout')); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

function parseVitePort(line) {
  // eslint-disable-next-line no-control-regex
  const stripped = line.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
  const m = stripped.match(/localhost:(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function startPreview(preferredPort = 4399) {
  console.log(`[audit-visual] Starting vite preview on :${preferredPort}…`);
  const proc = spawn(viteBin(), ['preview', '--port', String(preferredPort)], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  let resolvePort;
  const portPromise = new Promise(res => { resolvePort = res; });
  const onData = data => {
    const text = data.toString();
    const p = parseVitePort(text);
    if (p) resolvePort(p);
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  proc.on('error', err => { console.error('[vite]', err.message); resolvePort(null); });

  const port = await Promise.race([
    portPromise,
    new Promise(res => setTimeout(() => res(null), 12000)),
  ]);
  if (!port) { proc.kill(); throw new Error('vite preview did not emit a port'); }
  const base = `http://localhost:${port}`;
  await new Promise(r => setTimeout(r, 400));
  if (!await pollHttp(base, 8000)) {
    proc.kill();
    throw new Error(`vite preview did not respond at ${base}`);
  }
  console.log(`[audit-visual] Preview ready at ${base}`);
  return { proc, baseUrl: base };
}

// ── Findings collector ───────────────────────────────────────

const findings = [];
function add(id, severity, message, detail) {
  findings.push({ id, severity, message, detail });
}

// ── In-browser probes ────────────────────────────────────────

/**
 * Wait for the MAP overlay's network to be registered + stabilized.
 * Returns the slot name once available.
 */
async function openMapOverlay(page) {
  await page.evaluate(() => {
    const w = window;
    delete w.__kbeNetworks; // clear stale registrations from prior navigation
  });
  const mapBtn = page.getByRole('button', { name: 'MAP' });
  await mapBtn.waitFor({ state: 'visible', timeout: 8000 });
  await mapBtn.click();
  // Wait for the network to register and stabilize
  await page.waitForFunction(() => {
    const w = window;
    return !!(w.__kbeNetworks && w.__kbeNetworks['map-overlay']);
  }, { timeout: 10000 });
  await page.waitForTimeout(2500); // give physics time to settle
}

/**
 * In-page probe: returns the visible/labelled stats for the named slot.
 * Runs inside the browser so it can call into vis-network directly.
 */
async function probeNetwork(page, slot) {
  return page.evaluate((slotName) => {
    const w = window;
    const reg = w.__kbeNetworks?.[slotName];
    if (!reg) return null;
    const { network, container } = reg;
    const allIds = network.body?.data?.nodes?.getIds?.() ?? [];
    const rect = container.getBoundingClientRect();
    const positions = network.getPositions();

    // Project graph-space → screen-space for each node, count which are inside viewport
    const inView = [];
    for (const id of allIds) {
      const p = positions[id];
      if (!p) continue;
      const dom = network.canvasToDOM({ x: p.x, y: p.y });
      const sx = dom.x;
      const sy = dom.y;
      if (sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height) {
        const nodeData = network.body.data.nodes.get(id);
        // Custom renderer hides the rendered label inside a closure; the
        // engine mirrors it onto __auditLabel for inspection.
        const rendered = nodeData?.__auditLabel ?? nodeData?.label ?? '';
        inView.push({
          id,
          label: rendered,
          hasLabel: Boolean(rendered && String(rendered).trim().length > 0),
        });
      }
    }

    // Determine the focused node (selected) and its 1-hop neighbours
    const selected = network.getSelectedNodes();
    let focused = selected[0] ?? null;
    const neighbours = focused ? network.getConnectedNodes(focused) : [];
    const neighbourStats = neighbours.map(nid => {
      const nodeData = network.body.data.nodes.get(nid);
      const rendered = nodeData?.__auditLabel ?? nodeData?.label ?? '';
      return {
        id: nid,
        hasLabel: Boolean(rendered && String(rendered).trim().length > 0),
      };
    });

    return {
      total: allIds.length,
      inViewport: inView.length,
      withLabel: inView.filter(n => n.hasLabel).length,
      focused,
      neighbours: neighbourStats,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
  }, slot);
}

/**
 * Sample pixels off the canvas to assert it's non-blank and edges are visible.
 * We can't easily classify "edge pixel" vs "node pixel" — instead we look at
 * the *distribution* of luminance: a healthy graph paints a mix of dark BG +
 * mid-luminance edges + bright node fills. A graph with invisible edges
 * collapses to a bimodal BG + node distribution with very little mid-band.
 */
async function probeCanvasPixels(page, slot) {
  return page.evaluate((slotName) => {
    const w = window;
    const reg = w.__kbeNetworks?.[slotName];
    if (!reg) return null;
    const canvas = reg.container.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return { totalPixels: 0 };
    const img = ctx.getImageData(0, 0, W, H);
    const data = img.data;
    let nonBg = 0;
    let midBand = 0; // pixels in the contrast band where edges should live
    const isDark = document.documentElement.classList.contains('dark') ||
      document.body.style.backgroundColor === 'rgb(15, 15, 18)' ||
      getComputedStyle(document.body).backgroundColor.startsWith('rgb(15');
    // Sample every Nth pixel to keep this fast
    const stride = 4 * 4; // every 4th pixel
    for (let i = 0; i < data.length; i += stride) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a === 0) continue;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (isDark) {
        if (lum > 25) nonBg++;
        if (lum > 35 && lum < 140) midBand++; // edges + label text typically land here
      } else {
        if (lum < 235) nonBg++;
        if (lum < 220 && lum > 120) midBand++;
      }
    }
    const totalSamples = Math.floor(data.length / stride);
    return {
      totalPixels: totalSamples,
      nonBgFraction: nonBg / totalSamples,
      midBandFraction: midBand / totalSamples,
    };
  }, slot);
}

// ── Main audit ───────────────────────────────────────────────

async function main() {
  if (!opts.skipBuild && !opts.baseUrl) await buildLocalMode();

  let server = null;
  let baseUrl = opts.baseUrl;
  if (!baseUrl) {
    server = await startPreview();
    baseUrl = server.baseUrl;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    // ── Check 1: HUD related-links on repo-meta ────────────
    // After the fix, every issue/PR/branch/commit is tracked-in repo-meta.
    // Before the fix, repo-meta showed ~14 related items; now it should
    // surface many more across all the work artefacts.
    {
      await page.goto(`${baseUrl}/#/node/repo-meta`, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForSelector('.kb-prose', { timeout: 10000 });
      await page.waitForTimeout(1200);
      // Count node-link anchors anywhere on the page (HUD + reading view)
      const linkCount = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href*="#/node/"]');
        return anchors.length;
      });
      if (linkCount < 40) {
        add('hud-related-links', 'high',
          `repo-meta surfaces only ${linkCount} node links — work nodes likely not linked to the repository hub`,
          { linkCount });
      } else if (opts.verbose) {
        console.log(`[audit-visual] hud-related-links: ${linkCount} OK`);
      }
    }

    // ── Check 2: MAP legend cluster count ──────────────────
    // The unified `work` cluster + bounded provider clusters should keep the
    // legend under the 8-cluster sensemaking limit. Pre-fix this was 28+.
    {
      await page.goto(`${baseUrl}/#/node/readme`, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForSelector('.kb-prose', { timeout: 10000 });
      await openMapOverlay(page);

      // The legend lives in the MAP overlay — find any chip-like elements
      // labelled per cluster. We probe via the rendered graph data because
      // the MAP overlay legend's DOM structure may change; the source of
      // truth is graph.clusters.
      const legend = await page.evaluate(() => {
        const tagged = Array.from(document.querySelectorAll('[data-kbe-legend="cluster"]'));
        const overflow = document.querySelector('[data-kbe-legend="overflow"]');
        let overflowCount = 0;
        if (overflow) {
          const m = (overflow.textContent || '').match(/\+(\d+)/);
          if (m) overflowCount = parseInt(m[1], 10);
        }
        if (tagged.length > 0) {
          return {
            source: 'data-kbe-legend',
            count: tagged.length,
            overflowCount,
            names: tagged.map(el => el.textContent?.trim() ?? '').filter(Boolean),
          };
        }
        const chips = Array.from(document.querySelectorAll(
          '[class*="legend"] [class*="chip"], [class*="Legend"] [class*="Chip"]'
        ));
        return chips.length > 0
          ? { source: 'class-heuristic', count: chips.length, overflowCount: 0, names: chips.map(el => el.textContent?.trim() ?? '') }
          : { source: 'none', count: null, overflowCount: 0, names: [] };
      });
      const clusterCount = legend.count;
      // 12 matches LEGEND_VISIBLE_LIMIT in HUD.tsx. Anything above means the
      // UI cap stopped working — a real regression, not just a taxonomy drift.
      const VISIBLE_LIMIT = 12;
      // 5 hidden behind "+N more" is the design tolerance — beyond that the
      // cluster taxonomy itself has fragmented and the user can't reason about
      // the long tail at all, even with the overflow chip.
      const OVERFLOW_LIMIT = 5;
      if (clusterCount != null && clusterCount > VISIBLE_LIMIT) {
        add('legend-cluster-count', 'high',
          `MAP legend shows ${clusterCount} cluster chips — exceeds the ${VISIBLE_LIMIT}-chip cap (UI overflow chip stopped working?)`,
          { clusterCount, clusters: legend.names });
      } else if (legend.overflowCount > OVERFLOW_LIMIT) {
        add('legend-overflow-size', 'high',
          `MAP legend folds ${legend.overflowCount} clusters behind "+N more" — taxonomy has fragmented beyond ${OVERFLOW_LIMIT}-cluster tolerance`,
          { overflowCount: legend.overflowCount, visible: legend.names });
      } else if (opts.verbose) {
        const overflowNote = legend.overflowCount > 0 ? ` (+${legend.overflowCount} hidden)` : '';
        console.log(`[audit-visual] legend-cluster-count: ${clusterCount ?? 'n/a'}${overflowNote} OK`);
      }
    }

    // ── Checks 3-5: MAP canvas + label probes ──────────────
    // Reuse the open overlay from the previous step.
    {
      const stats = await probeNetwork(page, 'map-overlay');
      const pixels = await probeCanvasPixels(page, 'map-overlay');
      if (!stats) {
        add('map-canvas-non-blank', 'high', 'MAP overlay network never registered', {});
      } else {
        if (opts.verbose) console.log('[audit-visual] map stats', stats, pixels);

        // 3: non-blank
        if (!pixels || pixels.nonBgFraction < 0.005) {
          add('map-canvas-non-blank', 'high',
            `MAP canvas is effectively blank (${((pixels?.nonBgFraction ?? 0) * 100).toFixed(2)}% non-background pixels)`,
            { nonBgFraction: pixels?.nonBgFraction });
        }

        // 4: edges visible
        // Edges + labels should produce a measurable mid-luminance band. If
        // the only non-bg pixels are bright node fills (midBandFraction
        // collapses), edges have effectively vanished.
        if (pixels && pixels.nonBgFraction > 0.01 && pixels.midBandFraction < 0.002) {
          add('map-edge-visibility', 'high',
            `MAP has visible nodes but almost no mid-luminance pixels (${(pixels.midBandFraction * 100).toFixed(3)}%) — edges and labels are likely invisible`,
            pixels);
        }

        // 5: label coverage of in-viewport nodes
        // On a /#/node/<X> view, the focused node + its 1-hop neighbours
        // should be labelled. Across the whole viewport, key + connected
        // nodes should give ≥ 20% label coverage. Below that, the screen is
        // a sea of mystery circles.
        if (stats.inViewport >= 10) {
          const coverage = stats.withLabel / stats.inViewport;
          if (coverage < 0.20) {
            add('map-label-coverage', 'high',
              `Only ${(coverage * 100).toFixed(1)}% of ${stats.inViewport} in-viewport MAP nodes carry labels`,
              { coverage, inViewport: stats.inViewport, withLabel: stats.withLabel });
          } else if (opts.verbose) {
            console.log(`[audit-visual] map-label-coverage: ${(coverage * 100).toFixed(1)}% OK`);
          }
        }

        // 6: focused-neighbour labels
        // The labelDegreeThreshold override should guarantee every 1-hop
        // neighbour of the focused node has a label, even when the global
        // threshold suppresses them.
        if (stats.focused && stats.neighbours.length > 0) {
          const labelled = stats.neighbours.filter(n => n.hasLabel).length;
          const ratio = labelled / stats.neighbours.length;
          if (ratio < 0.80) {
            add('focus-neighbour-labels', 'high',
              `Only ${labelled}/${stats.neighbours.length} 1-hop neighbours of focused node "${stats.focused}" carry labels — focus override regressed`,
              { focused: stats.focused, labelled, total: stats.neighbours.length });
          } else if (opts.verbose) {
            console.log(`[audit-visual] focus-neighbour-labels: ${labelled}/${stats.neighbours.length} OK`);
          }
        }
      }

      // Diagnostic dump: cluster sizes in the MAP graph. Helps decide what to
      // fold when legend-cluster-count fails.
      if (opts.verbose) {
        const sizes = await page.evaluate(() => {
          const reg = window.__kbeNetworks;
          const slot = reg && reg['map-overlay'];
          if (!slot) return null;
          const nodes = slot.network.body.data.nodes.get();
          const counts = {};
          for (const n of nodes) {
            const c = n.cluster || '(unset)';
            counts[c] = (counts[c] || 0) + 1;
          }
          return Object.entries(counts).sort((a, b) => b[1] - a[1]);
        }).catch(() => null);
        if (sizes) console.log('[audit-visual] cluster sizes (MAP graph):', sizes);
      }
    }
  } finally {
    await browser.close();
    if (server) {
      try { server.proc.kill(); } catch { /* */ }
    }
  }

  // ── Report ────────────────────────────────────────────────
  console.log('\n[audit-visual] Findings:');
  if (findings.length === 0) {
    console.log('  ✓ No visual regressions detected.');
  } else {
    for (const f of findings) {
      console.log(`  ${f.severity === 'high' ? '✗' : '⚠'} [${f.id}] (${f.severity}) ${f.message}`);
      if (opts.verbose && f.detail) console.log('     ', f.detail);
    }
  }

  if (opts.failOn.size > 0) {
    const failed = findings.filter(f => opts.failOn.has(f.id));
    if (failed.length > 0) {
      console.log(`\n[audit-visual] Failed on: ${failed.map(f => f.id).join(', ')}`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('[audit-visual] Fatal:', err);
  process.exit(2);
});
