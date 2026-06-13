/**
 * capture-review.mjs
 *
 * Canonical review screenshot capture for kbexplorer (issue #240).
 *
 * Builds the app in local mode (VITE_KB_LOCAL=true), boots a Vite preview
 * server, then captures the surface set defined in scripts/review-surfaces.json
 * across every (theme × viewport) combination.
 *
 * Output: review/screenshots/<view>--<theme>--<viewport>.png
 * Report: review/capture-report.json
 *
 * Usage:
 *   npm run capture:review
 *   node scripts/capture-review.mjs [--surfaces-file <path>] [--out-dir <path>] [--skip-build]
 *
 * Options:
 *   --skip-build   Skip the local-mode build step (use when dist/ is already current)
 */

import { chromium } from 'playwright';
import http from 'node:http';
import { spawn } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    surfacesFile: resolve(__dirname, 'review-surfaces.json'),
    outDir: resolve(repoRoot, 'review', 'screenshots'),
    skipBuild: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--surfaces-file' && args[i + 1]) opts.surfacesFile = resolve(args[++i]);
    if (args[i] === '--out-dir' && args[i + 1]) opts.outDir = resolve(args[++i]);
    if (args[i] === '--skip-build') opts.skipBuild = true;
  }
  return opts;
}

// ── Local-mode build ──────────────────────────────────────────────────────────

async function buildLocalMode() {
  console.log('[capture] Building app in local mode (VITE_KB_LOCAL=true)…');

  // Step 1: generate-manifest
  await new Promise((res, rej) => {
    const proc = spawn(
      process.platform === 'win32' ? 'node.exe' : 'node',
      ['scripts/generate-manifest.js'],
      { cwd: repoRoot, stdio: 'inherit', env: { ...process.env } },
    );
    proc.on('close', code => code === 0 ? res() : rej(new Error(`generate-manifest exited ${code}`)));
    proc.on('error', rej);
  });

  // Step 2: vite build with VITE_KB_LOCAL=true
  const viteBin = process.platform === 'win32'
    ? join(repoRoot, 'node_modules', '.bin', 'vite.cmd')
    : join(repoRoot, 'node_modules', '.bin', 'vite');

  await new Promise((res, rej) => {
    const proc = spawn(
      viteBin,
      ['build'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, VITE_KB_LOCAL: 'true' },
      },
    );
    proc.on('close', code => code === 0 ? res() : rej(new Error(`vite build exited ${code}`)));
    proc.on('error', rej);
  });

  console.log('[capture] Build complete.');
}

// ── Port helpers ──────────────────────────────────────────────────────────────

async function pollHttp(url, maxMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await new Promise((res, rej) => {
        const req = http.get(url, () => res());
        req.on('error', rej);
        req.setTimeout(1500, () => { req.destroy(); rej(new Error('timeout')); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return false;
}

// ── Vite preview server ───────────────────────────────────────────────────────

/**
 * Parse the actual bound port from vite's "Local: http://localhost:NNNN/" output.
 * Strips ANSI escape codes before matching.
 * Returns undefined if the line doesn't match.
 */
function parseVitePort(line) {
  // Strip ANSI escape sequences (color codes etc.)
  // eslint-disable-next-line no-control-regex
  const stripped = line.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
  const m = stripped.match(/localhost:(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

async function startPreview(preferredPort) {
  console.log(`[capture] Starting vite preview (preferred port ${preferredPort})…`);

  const viteBin = process.platform === 'win32'
    ? join(repoRoot, 'node_modules', '.bin', 'vite.cmd')
    : join(repoRoot, 'node_modules', '.bin', 'vite');

  let resolvePort;
  const portPromise = new Promise(res => { resolvePort = res; });

  const proc = spawn(
    viteBin,
    ['preview', '--port', String(preferredPort)],
    {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    },
  );

  const onData = (data) => {
    const text = data.toString();
    process.stdout.write('[vite] ' + text);
    const p = parseVitePort(text);
    if (p) resolvePort(p);
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', d => process.stdout.write('[vite] ' + d.toString()));
  proc.on('error', err => {
    console.error('[vite] spawn error:', err.message);
    resolvePort(null);
  });

  // Race: parse port from stdout vs timeout
  const actualPort = await Promise.race([
    portPromise,
    new Promise(res => setTimeout(() => res(null), 12000)),
  ]);

  if (!actualPort) {
    proc.kill();
    throw new Error('Vite preview server did not emit a port within 12s');
  }

  const baseUrl = `http://localhost:${actualPort}`;
  // Give vite a moment after printing the port
  await new Promise(r => setTimeout(r, 500));
  // Verify it's actually responding
  const ready = await pollHttp(baseUrl, 8000);
  if (!ready) {
    proc.kill();
    throw new Error(`Vite preview server did not respond at ${baseUrl}`);
  }
  console.log(`[capture] Server ready at ${baseUrl}`);
  return { proc, port: actualPort, baseUrl };
}

// ── Surface actions ───────────────────────────────────────────────────────────

async function performAction(page, action) {
  if (!action) return null;

  if (action === 'open-map') {
    const mapBtn = page.getByRole('button', { name: 'MAP' });
    if (await mapBtn.count() > 0) {
      try {
        await mapBtn.waitFor({ state: 'visible', timeout: 5000 });
        await mapBtn.click();
        await page.waitForTimeout(1500);
      } catch { /* MAP button not visible */ }
    }
    return null;
  }

  if (action === 'select-node') {
    // The HUD shows related node connections — click one to go to a different node
    // which shows neighbourhood emphasis in the minimap/graph
    const connectionLink = page.locator('a[href*="#/node/"]').first();
    if (await connectionLink.count() > 0) {
      try {
        await connectionLink.waitFor({ state: 'visible', timeout: 5000 });
        await connectionLink.click();
        await page.waitForTimeout(1500);
        // Wait for navigation to settle
        await page.waitForSelector('.kb-prose', { timeout: 8000 }).catch(() => {});
      } catch { /* link not visible */ }
    }
    return null;
  }

  if (action === 'open-source-editor') {
    // Look for an Edit/Source button
    const editBtn = page.getByRole('button', { name: /Edit|Source/i });
    if (await editBtn.count() > 0) {
      try {
        await editBtn.waitFor({ state: 'visible', timeout: 5000 });
        await editBtn.click();
        await page.waitForTimeout(1500);
        // Check if dialog appeared
        const dialogOpen = await page.locator('[role="dialog"]').count() > 0;
        return dialogOpen ? null : 'dialog-not-found';
      } catch {
        return 'edit-button-not-visible';
      }
    }
    return 'edit-button-not-found';
  }

  return null;
}

// ── Sanity check ──────────────────────────────────────────────────────────────

const MIN_BYTES = 5000; // < 5 KB is almost certainly blank/error

function checkSize(path) {
  try {
    const st = statSync(path);
    return { ok: st.size >= MIN_BYTES, bytes: st.size };
  } catch {
    return { ok: false, bytes: 0 };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { surfacesFile, outDir, skipBuild } = parseArgs();

  // Build the app in local mode unless explicitly skipped
  if (!skipBuild) {
    try {
      await buildLocalMode();
    } catch (err) {
      console.error('[capture] Build failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('[capture] Skipping build (--skip-build). Using existing dist/.');
  }

  const manifest = JSON.parse(readFileSync(surfacesFile, 'utf-8'));
  const { surfaces, themes, viewports } = manifest;

  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(repoRoot, 'review'), { recursive: true });

  let previewProc, baseUrl;
  try {
    const result = await startPreview(4299);
    previewProc = result.proc;
    baseUrl = result.baseUrl;
  } catch (err) {
    console.error('[capture] Failed to start preview server:', err.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const report = { capturedAt: new Date().toISOString(), surfaces: [] };

  let totalCaptured = 0;
  let totalSkipped = 0;

  try {
    // Outer loop: theme × viewport — create one context per combo, reuse for all surfaces
    for (const theme of themes) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();

        // Prime localStorage once for this (theme, viewport) context
        try {
          await page.goto(`${baseUrl}/#/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.evaluate((t) => {
            localStorage.setItem('kbe-theme', t);
          }, theme);
        } catch (err) {
          console.error(`[capture] Failed to prime context for theme=${theme} vp=${vp.id}: ${err.message}`);
          await context.close();
          // Record all surfaces as errors for this combo
          for (const surface of surfaces) {
            report.surfaces.push({
              surfaceId: surface.id,
              surfaceLabel: surface.label,
              theme,
              viewport: vp.id,
              filename: `${surface.id}--${theme}--${vp.id}.png`,
              status: 'error',
              bytes: 0,
              skipReason: `Context init failed: ${err.message}`,
              error: err.message,
            });
            totalSkipped++;
          }
          continue;
        }

        for (const surface of surfaces) {
          const filename = `${surface.id}--${theme}--${vp.id}.png`;
          const outPath = resolve(outDir, filename);

          let status = 'captured';
          let skipReason = null;
          let bytes = 0;
          let error = null;

          try {
            // Set any surface-specific localStorage keys
            if (surface.setup?.localStorage) {
              await page.evaluate((kvs) => {
                for (const [k, v] of Object.entries(kvs)) {
                  localStorage.setItem(k, v);
                }
              }, surface.setup.localStorage);
            } else {
              // Clear HUD overrides so the surface renders in default state
              await page.evaluate(() => {
                localStorage.removeItem('kbe-hud-collapsed');
                // Leave dock at bottom (default)
                localStorage.setItem('kbe-hud-dock', 'bottom');
              });
            }

            // Navigate to target URL
            const targetUrl = `${baseUrl}${surface.url}`;
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 25000 });

            // Wait for primary content selector
            if (surface.waitFor) {
              try {
                await page.waitForSelector(surface.waitFor, { timeout: 8000 });
              } catch { /* selector may not exist on all views */ }
            }

            // Settle delay
            const settleMs = surface.settleMs ?? 1500;
            await page.waitForTimeout(settleMs);

            // Perform surface-specific action
            const actionResult = await performAction(page, surface.action);

            // For open-source-editor, check if dialog was found
            if (surface.action === 'open-source-editor' && surface.skipIfNotFound) {
              if (actionResult !== null) {
                status = 'skipped';
                skipReason = `Source editor dialog not opened: ${actionResult}`;
                totalSkipped++;
              }
            }

            if (status !== 'skipped') {
              await page.screenshot({ path: outPath, fullPage: false });
              const check = checkSize(outPath);
              if (!check.ok) {
                status = 'warning';
                skipReason = `Screenshot small (${check.bytes} B) — may be blank`;
              }
              bytes = check.bytes;
              totalCaptured++;
              console.log(`  [+] ${filename} (${(bytes / 1024).toFixed(1)} KB)`);
            } else {
              console.log(`  [-] SKIP ${filename}: ${skipReason}`);
            }
          } catch (err) {
            status = 'error';
            error = err.message;
            skipReason = err.message;
            totalSkipped++;
            console.error(`  [!] ERROR ${filename}: ${err.message.slice(0, 120)}`);
          }

          report.surfaces.push({
            surfaceId: surface.id,
            surfaceLabel: surface.label,
            theme,
            viewport: vp.id,
            filename,
            status,
            bytes,
            skipReason,
            error,
          });
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (previewProc) {
      previewProc.kill();
      // On Windows, also kill child processes
      if (process.platform === 'win32') {
        try {
          const { execSync } = await import('child_process');
          execSync(`taskkill /F /T /PID ${previewProc.pid} 2>nul`, { stdio: 'ignore' });
        } catch { /* ignore */ }
      }
    }
  }

  // Write report
  const reportPath = resolve(repoRoot, 'review', 'capture-report.json');
  report.summary = {
    totalSurfaces: surfaces.length,
    themes: themes.length,
    viewports: viewports.length,
    expectedCaptures: surfaces.length * themes.length * viewports.length,
    captured: totalCaptured,
    skipped: totalSkipped,
    outputDir: outDir,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n── Capture complete ─────────────────────────────────────────');
  console.log(`  Captured : ${totalCaptured}`);
  console.log(`  Skipped  : ${totalSkipped}`);
  console.log(`  Output   : ${outDir}`);
  console.log(`  Report   : ${reportPath}`);

  if (totalCaptured === 0) {
    console.error('\n[capture] ERROR: No screenshots were captured!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[capture] Fatal error:', err);
  process.exit(1);
});
