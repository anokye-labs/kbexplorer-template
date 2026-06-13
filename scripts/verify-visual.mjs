/**
 * verify-visual.mjs
 *
 * Visual-regression gate for kbexplorer (issue #257).
 *
 * Compares freshly-captured screenshots against committed baselines using
 * pixelmatch for perceptual pixel diffing. Fails with a non-zero exit code
 * and writes a diff report when any surface drifts beyond the tolerance.
 *
 * Diff approach (documented in review/README.md):
 *   - Tool: pixelmatch (pixel-level perceptual diff with anti-aliasing aware
 *     threshold). Baselines are committed PNG files in review/baselines/.
 *     Full PNGs (~14 MB total for 72 surfaces) are lighter than the
 *     Playwright report artifact and simpler to review than hash-only diffs
 *     (you can open the actual diff image). Hash-only approaches lose the
 *     ability to render a human-readable diff PNG.
 *   - Tolerance: 0.1 (pixelmatch `threshold` — perceptual distance per
 *     channel, 0=exact, 1=all pass). Allows sub-pixel anti-aliasing variance
 *     between OS/font-render environments while catching real layout shifts.
 *   - Fail threshold: any surface with > 0.5% differing pixels fails.
 *
 * Usage:
 *   npm run verify:visual
 *   node scripts/verify-visual.mjs [--screenshots-dir <path>] [--baselines-dir <path>] [--diff-dir <path>] [--threshold <0-1>] [--fail-percent <0-100>]
 *
 * Bootstrapping baselines (first time or after an intentional design change):
 *   npm run capture:review -- --update-baselines
 *   git add review/baselines
 *   git commit -m "chore(review): update visual baselines"
 *
 * NOT part of the fast PR gate — runs as a manual/nightly workflow
 * (.github/workflows/visual-regression.yml) with workflow_dispatch + schedule.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    screenshotsDir: resolve(repoRoot, 'review', 'screenshots'),
    baselinesDir: resolve(repoRoot, 'review', 'baselines'),
    diffDir: resolve(repoRoot, 'review', 'diffs'),
    // pixelmatch perceptual threshold per channel (0=exact, 1=all pass).
    // 0.1 is permissive enough for font-rendering variance across CI/local
    // while catching real layout or color shifts.
    threshold: 0.1,
    // Percentage of total pixels that may differ before a surface fails.
    failPercent: 0.5,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--screenshots-dir' && args[i + 1]) opts.screenshotsDir = resolve(args[++i]);
    if (args[i] === '--baselines-dir' && args[i + 1]) opts.baselinesDir = resolve(args[++i]);
    if (args[i] === '--diff-dir' && args[i + 1]) opts.diffDir = resolve(args[++i]);
    if (args[i] === '--threshold' && args[i + 1]) opts.threshold = parseFloat(args[++i]);
    if (args[i] === '--fail-percent' && args[i + 1]) opts.failPercent = parseFloat(args[++i]);
  }
  return opts;
}

// ── PNG helpers ───────────────────────────────────────────────────────────────

function readPng(filePath) {
  const buf = readFileSync(filePath);
  return PNG.sync.read(buf);
}

function writePng(filePath, png) {
  const buf = PNG.sync.write(png);
  writeFileSync(filePath, buf);
}

// ── Diff one pair ─────────────────────────────────────────────────────────────

/**
 * Compare baseline vs current screenshot.
 * Returns { diffPixels, totalPixels, diffPercent, diffPath }.
 * Writes the diff PNG to diffDir (only when there are differences).
 */
function diffImages(baselinePath, currentPath, diffDir, filename, threshold) {
  const baseline = readPng(baselinePath);
  const current = readPng(currentPath);

  // If dimensions differ, treat every pixel as changed.
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      diffPixels: baseline.width * baseline.height,
      totalPixels: baseline.width * baseline.height,
      diffPercent: 100,
      dimensionMismatch: {
        baseline: `${baseline.width}×${baseline.height}`,
        current: `${current.width}×${current.height}`,
      },
      diffPath: null,
    };
  }

  const { width, height } = baseline;
  const totalPixels = width * height;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(
    baseline.data,
    current.data,
    diffPng.data,
    width,
    height,
    { threshold, includeAA: false },
  );

  const diffPercent = (diffPixels / totalPixels) * 100;

  let diffPath = null;
  if (diffPixels > 0) {
    mkdirSync(diffDir, { recursive: true });
    diffPath = resolve(diffDir, filename);
    writePng(diffPath, diffPng);
  }

  return { diffPixels, totalPixels, diffPercent, diffPath };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { screenshotsDir, baselinesDir, diffDir, threshold, failPercent } = parseArgs();

  // Guard: baselines must exist.
  if (!existsSync(baselinesDir)) {
    console.error('[verify:visual] ERROR: Baselines directory not found:', baselinesDir);
    console.error('[verify:visual] Bootstrap baselines first:');
    console.error('[verify:visual]   npm run capture:review -- --update-baselines');
    console.error('[verify:visual]   git add review/baselines && git commit -m "chore(review): seed visual baselines"');
    process.exit(1);
  }

  // Guard: screenshots must exist.
  if (!existsSync(screenshotsDir)) {
    console.error('[verify:visual] ERROR: Screenshots directory not found:', screenshotsDir);
    console.error('[verify:visual] Run captures first:  npm run capture:review -- --skip-build');
    process.exit(1);
  }

  const baselineFiles = readdirSync(baselinesDir).filter(f => f.endsWith('.png'));
  const currentFiles = new Set(readdirSync(screenshotsDir).filter(f => f.endsWith('.png')));

  if (baselineFiles.length === 0) {
    console.error('[verify:visual] ERROR: No baseline PNGs found in', baselinesDir);
    process.exit(1);
  }

  console.log(`[verify:visual] Comparing ${baselineFiles.length} baseline(s) in ${relative(repoRoot, baselinesDir).split(sep).join('/')}`);
  console.log(`[verify:visual] Against screenshots in  ${relative(repoRoot, screenshotsDir).split(sep).join('/')}`);
  console.log(`[verify:visual] Threshold: ${threshold} per-channel | Fail at: >${failPercent}% differing pixels\n`);

  const results = [];
  let passed = 0;
  let failed = 0;
  let missing = 0;
  let skippedNoBaseline = 0;

  for (const filename of baselineFiles) {
    const baselinePath = resolve(baselinesDir, filename);

    if (!currentFiles.has(filename)) {
      // Surface was not captured in this run (may be a skipped surface).
      // Treat as missing — not a failure (skipped surfaces won't be captured).
      results.push({ filename, status: 'missing', note: 'Not found in screenshots dir (skipped surface?)' });
      missing++;
      console.log(`  [?] MISSING   ${filename}`);
      continue;
    }

    const currentPath = resolve(screenshotsDir, filename);
    let result;
    try {
      result = diffImages(baselinePath, currentPath, diffDir, filename, threshold);
    } catch (err) {
      results.push({ filename, status: 'error', error: err.message });
      failed++;
      console.error(`  [!] ERROR     ${filename}: ${err.message}`);
      continue;
    }

    const { diffPixels, totalPixels, diffPercent, dimensionMismatch, diffPath } = result;
    const pass = diffPercent <= failPercent && !dimensionMismatch;

    const entry = {
      filename,
      status: pass ? 'pass' : 'fail',
      diffPixels,
      totalPixels,
      diffPercent: parseFloat(diffPercent.toFixed(4)),
      diffPath: diffPath
        ? relative(repoRoot, diffPath).split(sep).join('/')
        : null,
      dimensionMismatch: dimensionMismatch ?? null,
    };
    results.push(entry);

    if (pass) {
      passed++;
      if (diffPercent > 0) {
        console.log(`  [✓] PASS      ${filename}  (${diffPercent.toFixed(3)}% diff — within tolerance)`);
      } else {
        console.log(`  [✓] PASS      ${filename}  (pixel-perfect)`);
      }
    } else {
      failed++;
      if (dimensionMismatch) {
        console.error(`  [✗] FAIL      ${filename}  (dimension mismatch: baseline ${dimensionMismatch.baseline} vs current ${dimensionMismatch.current})`);
      } else {
        console.error(`  [✗] FAIL      ${filename}  (${diffPercent.toFixed(3)}% diff — exceeds ${failPercent}% limit; diff → ${entry.diffPath})`);
      }
    }
  }

  // Write diff report.
  const reportPath = resolve(repoRoot, 'review', 'visual-diff-report.json');
  const report = {
    ranAt: new Date().toISOString(),
    config: { threshold, failPercent },
    summary: {
      baselines: baselineFiles.length,
      passed,
      failed,
      missing,
      skippedNoBaseline,
    },
    results,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n── Visual regression check ──────────────────────────────────');
  console.log(`  Passed   : ${passed}`);
  console.log(`  Failed   : ${failed}`);
  console.log(`  Missing  : ${missing}`);
  console.log(`  Report   : ${reportPath}`);
  if (failed > 0) {
    console.log(`  Diffs    : ${diffDir}`);
  }

  if (failed > 0) {
    console.error(`\n[verify:visual] FAILED — ${failed} surface(s) exceeded the diff threshold.`);
    console.error('[verify:visual] To accept these changes as the new baseline, run:');
    console.error('[verify:visual]   npm run capture:review -- --skip-build --update-baselines');
    console.error('[verify:visual]   git add review/baselines && git commit -m "chore(review): update visual baselines"');
    process.exit(1);
  }

  console.log('\n[verify:visual] All surfaces pass.');
}

main().catch(err => {
  console.error('[verify:visual] Fatal error:', err);
  process.exit(1);
});
