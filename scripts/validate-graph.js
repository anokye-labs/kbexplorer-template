#!/usr/bin/env node

/**
 * Graph validation script for kbexplorer.
 *
 * Loads the content directory and config directly (no TypeScript compilation)
 * and checks structural integrity of the knowledge graph.
 *
 * Exit 0 on warnings only, exit 1 on errors.
 */

import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import yaml from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbRoot = resolve(__dirname, '..');
const contentDir = resolve(kbRoot, 'content');

// ── Helpers ────────────────────────────────────────────────

function log(msg) {
  console.log(`[validate] ${msg}`);
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

/** Strip fenced code blocks and inline code spans so we don't match examples. */
function stripCode(body) {
  // Remove fenced code blocks (``` ... ```)
  let stripped = body.replace(/```[\s\S]*?```/g, '');
  // Remove inline code (`...`)
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

// ── Load data ──────────────────────────────────────────────

log('Loading manifest...');

// Read authored content files directly
const authoredContent = {};
if (existsSync(contentDir)) {
  for (const entry of readdirSync(contentDir)) {
    if (extname(entry) === '.md') {
      const raw = readFileSync(resolve(contentDir, entry), 'utf-8');
      authoredContent[`content/${entry}`] = raw;
    }
  }
}

// Read config.yaml
let config = {};
const configPath = resolve(contentDir, 'config.yaml');
if (existsSync(configPath)) {
  config = yaml.parse(readFileSync(configPath, 'utf-8')) || {};
}

// Read nodemap.yaml
let nodemap = null;
const nodemapPath = resolve(kbRoot, 'nodemap.yaml');
if (existsSync(nodemapPath)) {
  nodemap = yaml.parse(readFileSync(nodemapPath, 'utf-8'));
}

// Read manifest for issues, PRs, tree (if it exists)
let manifest = null;
const manifestPath = resolve(kbRoot, 'src', 'generated', 'repo-manifest.json');
if (existsSync(manifestPath)) {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
}

// ── Build node ID set ──────────────────────────────────────

const parsedContent = [];
for (const [path, raw] of Object.entries(authoredContent)) {
  const { meta, body } = parseFrontmatter(raw);
  if (meta.id) {
    parsedContent.push({ path, id: meta.id, meta, body, links: extractInlineLinks(body) });
  }
}

const nodeIds = new Set();

// Authored content IDs
for (const c of parsedContent) nodeIds.add(c.id);

// Issue IDs
const issues = manifest?.issues ?? [];
for (const iss of issues) nodeIds.add(`issue-${iss.number}`);

// PR IDs
const prs = manifest?.pullRequests ?? [];
for (const pr of prs) nodeIds.add(`pr-${pr.number}`);

// Tree file IDs
const tree = manifest?.tree ?? [];
for (const t of tree) nodeIds.add(t.path);

// README
if (manifest?.readme) nodeIds.add('readme');

const contentCount = parsedContent.length;
const issueCount = issues.length;
const treeCount = tree.length;
log(`${contentCount} content files, ${issueCount} issues, ${treeCount} tree entries`);

// ── Validation ─────────────────────────────────────────────

let warnings = 0;
let errors = 0;

// Rule 1: No broken inline links
const brokenLinks = [];
for (const c of parsedContent) {
  for (const target of c.links) {
    if (!nodeIds.has(target)) {
      brokenLinks.push({ from: c.id, target });
    }
  }
}
if (brokenLinks.length > 0) {
  errors += brokenLinks.length;
  log(`❌ ${brokenLinks.length} broken inline link(s):`);
  for (const b of brokenLinks) {
    log(`   ${b.from} → ${b.target}`);
  }
} else {
  log('✅ No broken inline links');
}

// Rule 2: No duplicate node IDs
const idCounts = {};
for (const c of parsedContent) {
  idCounts[c.id] = (idCounts[c.id] || 0) + 1;
}
const duplicates = Object.entries(idCounts).filter(([, n]) => n > 1).map(([id]) => id);
if (duplicates.length > 0) {
  errors += duplicates.length;
  log(`❌ ${duplicates.length} duplicate ID(s): ${duplicates.join(', ')}`);
} else {
  log('✅ No duplicate IDs');
}

// Rule 3: No orphan authored nodes
const incomingCount = {};
for (const c of parsedContent) incomingCount[c.id] = 0;
for (const c of parsedContent) {
  for (const target of c.links) {
    if (target in incomingCount) {
      incomingCount[target]++;
    }
  }
}
const orphans = Object.entries(incomingCount)
  .filter(([, count]) => count === 0)
  .map(([id]) => id);
if (orphans.length > 0) {
  warnings += orphans.length;
  log(`⚠️ ${orphans.length} orphan node(s): ${orphans.join(', ')}`);
} else {
  log('✅ No orphan authored nodes');
}

// Rule 4: All cluster assignments valid
const definedClusters = new Set(Object.keys(config.clusters || {}));
const badClusters = [];
for (const c of parsedContent) {
  if (c.meta.cluster && !definedClusters.has(c.meta.cluster)) {
    badClusters.push({ id: c.id, cluster: c.meta.cluster });
  }
}
if (badClusters.length > 0) {
  errors += badClusters.length;
  log(`❌ ${badClusters.length} invalid cluster(s):`);
  for (const b of badClusters) {
    log(`   ${b.id} → cluster "${b.cluster}"`);
  }
} else {
  log('✅ All clusters valid');
}

// Rule 5: Nodemap identity consistency
if (nodemap?.nodes) {
  const missingFiles = [];
  for (const node of nodemap.nodes) {
    if (node.file) {
      if (!existsSync(resolve(kbRoot, node.file))) {
        missingFiles.push({ id: node.id, file: node.file });
      }
    }
    if (node.directory) {
      if (!existsSync(resolve(kbRoot, node.directory))) {
        missingFiles.push({ id: node.id, file: node.directory });
      }
    }
    if (node.files) {
      for (const f of node.files) {
        if (!existsSync(resolve(kbRoot, f))) {
          missingFiles.push({ id: node.id, file: f });
        }
      }
    }
  }
  if (missingFiles.length > 0) {
    errors += missingFiles.length;
    log(`❌ ${missingFiles.length} nodemap path(s) missing:`);
    for (const m of missingFiles) {
      log(`   ${m.id} → ${m.file}`);
    }
  } else {
    log('✅ Nodemap files exist');
  }
} else {
  log('⏭️ No nodemap.yaml — skipping');
}

// Rule 6: Content quality — no empty body
const emptyContent = [];
for (const c of parsedContent) {
  if (!c.body.trim()) {
    emptyContent.push(c.id);
  }
}
if (emptyContent.length > 0) {
  warnings += emptyContent.length;
  log(`⚠️ ${emptyContent.length} empty content file(s): ${emptyContent.join(', ')}`);
} else {
  log('✅ No empty content');
}

// ── Summary ────────────────────────────────────────────────

log(`Result: ${warnings} warning(s), ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
