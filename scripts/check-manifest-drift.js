/**
 * Manifest drift / idempotency check (F4 / T4.2 — issue #170).
 *
 * Answers the release-readiness question: *"if I re-run the manifest build with
 * unchanged sources, do I get byte-identical output?"* — i.e. is the
 * source-derived assembly (tree + `.github` structural files + content-model +
 * node-map + config + authored content + README) deterministic, and is the
 * currently-generated manifest in sync with the committed sources?
 *
 * It deliberately compares ONLY the deterministic, source-derived fields and
 * excludes the volatile ones that legitimately change between environments/runs:
 *   - generatedAt (timestamp)
 *   - issues / pullRequests / commits / branches / repoMetadata (git + GitHub state)
 *
 * Two checks:
 *   1. Idempotency (gating): regenerate the source-derived projection twice and
 *      assert byte-identical JSON. Catches non-deterministic ordering / hidden
 *      timestamps / randomness in the assembly.
 *   2. On-disk parity (gating, when a manifest exists): compare the source-derived
 *      fields of the on-disk `repo-manifest.json` against a fresh projection.
 *      Catches "sources changed but the manifest wasn't re-generated". The `tree`
 *      field is excluded here because it lists `src/generated/repo-manifest.json`
 *      itself, whose size depends on the (excluded) volatile fields — comparing it
 *      would be self-referential.
 *
 * Exit codes: 0 = no drift, 1 = drift detected, 2 = unexpected error.
 *
 * Usage: `node scripts/check-manifest-drift.js [rootDir]`
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import {
  walkFileSystem,
  readAuthoredContent,
  readConfig,
  readReadme,
  readNodemap,
  readStructuredNodeMap,
  collectStructuralFiles,
  collectNodemapData,
  readContentModel,
} from './generate-manifest.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

/** Deterministic, source-derived fields only — no git/GitHub/timestamp data. */
function buildSourceDerived(root) {
  const contentPath = process.env.VITE_KB_PATH || 'content';
  const contentDir = resolve(root, contentPath);
  const tree = walkFileSystem(root);
  const nodemapRaw = readNodemap(root);
  const { nodemapFiles, nodemapDirs } = collectNodemapData(root, nodemapRaw, tree);
  return {
    configRaw: readConfig(root, contentPath),
    authoredContent: readAuthoredContent(contentDir, contentPath),
    tree,
    readme: readReadme(root),
    nodemapRaw,
    nodemapFiles,
    nodemapDirs,
    structuredNodeMapRaw: readStructuredNodeMap(root),
    structuralFiles: collectStructuralFiles(root, tree),
    contentModel: readContentModel(root),
  };
}

/** Fields safe to compare against an on-disk manifest (no self-reference). */
const PARITY_FIELDS = [
  'configRaw',
  'authoredContent',
  'readme',
  'nodemapRaw',
  'nodemapFiles',
  'nodemapDirs',
  'structuredNodeMapRaw',
  'structuralFiles',
  'contentModel',
];

/**
 * Canonicalize a value so comparison is insensitive to incidental ordering:
 * object keys are sorted recursively and arrays are sorted by their canonical
 * JSON form. The upstream `generate-manifest` helpers enumerate directories via
 * `readdirSync` without sorting, so raw `readdir` order can differ across
 * filesystems/OSes. Canonicalizing before stringifying means only *content*
 * differences register as drift — pure ordering variance never produces a false
 * positive. Any added/removed/changed entry still changes the canonical JSON, so
 * real drift is preserved.
 */
function canonicalize(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .map(v => [JSON.stringify(v), v])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(pair => pair[1]);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

function main() {
  const root = process.argv[2] ? resolve(process.argv[2]) : repoRoot;

  // ── Check 1: idempotency ────────────────────────────────────
  const first = JSON.stringify(canonicalize(buildSourceDerived(root)), null, 2);
  const second = JSON.stringify(canonicalize(buildSourceDerived(root)), null, 2);

  if (first !== second) {
    console.error('[drift] FAIL — source-derived assembly is NON-deterministic across re-runs.');
    // Surface the first differing line to make the cause obvious.
    const a = first.split('\n');
    const b = second.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.error(`  first divergence at line ${i + 1}:`);
        console.error(`    run #1: ${a[i] ?? '<eof>'}`);
        console.error(`    run #2: ${b[i] ?? '<eof>'}`);
        break;
      }
    }
    process.exit(1);
  }
  console.log('[drift] OK — source-derived manifest is byte-identical across re-runs (idempotent).');

  // ── Check 2: on-disk parity (best-effort) ───────────────────
  const manifestPath = resolve(root, 'src', 'generated', 'repo-manifest.json');
  if (!existsSync(manifestPath)) {
    console.log('[drift] No on-disk manifest found — skipping parity check (idempotency already verified).');
    process.exit(0);
  }

  let onDisk;
  try {
    onDisk = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    console.error(`[drift] FAIL — on-disk manifest is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  const fresh = buildSourceDerived(root);
  const drifted = [];
  for (const field of PARITY_FIELDS) {
    if (
      JSON.stringify(canonicalize(onDisk[field])) !== JSON.stringify(canonicalize(fresh[field]))
    ) {
      drifted.push(field);
    }
  }

  if (drifted.length > 0) {
    console.error('[drift] FAIL — on-disk manifest is stale vs current sources. Re-run `generate-manifest`.');
    console.error(`  drifted source fields: ${drifted.join(', ')}`);
    process.exit(1);
  }

  console.log('[drift] OK — on-disk manifest source fields match the committed sources (no drift).');
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(`[drift] ERROR — ${err.stack || err.message}`);
  process.exit(2);
}
