#!/usr/bin/env node
/**
 * Compare derived content to existing content.
 * Usage: node scripts/compare-content.js [--baseline path/to/content]
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Parse --baseline flag (defaults to content/)
const args = process.argv.slice(2);
const baselineIdx = args.indexOf("--baseline");
const contentDir =
  baselineIdx !== -1 && args[baselineIdx + 1]
    ? resolve(root, args[baselineIdx + 1])
    : resolve(root, "content");

const cataloguePath = resolve(root, "content", "catalogue.json");

if (!existsSync(cataloguePath)) {
  console.error(
    "[compare] content/catalogue.json not found — run kb-architect first"
  );
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(cataloguePath, "utf-8"));
const nodes = catalogue.nodes ?? [];

// Gather content files (only .md)
const contentFiles = existsSync(contentDir)
  ? readdirSync(contentDir).filter((f) => extname(f) === ".md")
  : [];
const contentIds = new Set(contentFiles.map((f) => f.replace(/\.md$/, "")));

// ── Classify nodes ─────────────────────────────────────────
const authoredNodes = [];
const derivedCurrent = [];
const missingNodes = [];
const clusterChanges = [];
const linkDiffs = [];

const catalogueIds = new Set();

for (const node of nodes) {
  catalogueIds.add(node.id);
  const filePath = resolve(contentDir, `${node.id}.md`);
  const fileExists = existsSync(filePath);

  if (node.authored) {
    if (fileExists) {
      authoredNodes.push(node);
    } else {
      missingNodes.push(node);
    }
  } else if (node.derived) {
    if (fileExists) {
      derivedCurrent.push(node);
      // Check for cluster drift — compare catalogue cluster to frontmatter
      const raw = readFileSync(filePath, "utf-8");
      const clusterMatch = raw.match(/^cluster:\s*(.+)$/m);
      if (clusterMatch) {
        const fileCluster = clusterMatch[1].trim();
        if (fileCluster !== node.cluster) {
          clusterChanges.push({
            id: node.id,
            from: fileCluster,
            to: node.cluster,
          });
        }
      }
      // Compare link counts
      const hintCount = (node.edgeHints ?? []).length;
      const linkMatches = raw.match(/\[([^\]]+)\]\(([^)]+)\)/g) ?? [];
      const diff = Math.abs(hintCount - linkMatches.length);
      if (diff > 3) {
        linkDiffs.push({
          id: node.id,
          catalogue: hintCount,
          file: linkMatches.length,
        });
      }
    } else {
      missingNodes.push(node);
    }
  }
}

// Nodes in content/ but not in catalogue
const extraFiles = [...contentIds].filter(
  (id) => !catalogueIds.has(id) && id !== "catalogue"
);

// ── Report ─────────────────────────────────────────────────
console.log(
  `[compare] Comparing catalogue (${nodes.length} nodes) to content/ (${contentFiles.length} files)\n`
);

console.log("[compare] ── Coverage ──");
console.log(
  `[compare] Authored (preserved):    ${String(authoredNodes.length).padStart(2)}`
);
console.log(
  `[compare] Derived (current):       ${String(derivedCurrent.length).padStart(2)}`
);
console.log(
  `[compare] Missing (needs gen):     ${String(missingNodes.length).padStart(2)}`
);
console.log(
  `[compare] Extra (not in catalogue):${String(extraFiles.length).padStart(2)}`
);

if (missingNodes.length > 0) {
  for (const n of missingNodes) {
    console.log(`[compare]   ${n.id}: needs generation`);
  }
}
if (extraFiles.length > 0) {
  for (const id of extraFiles) {
    console.log(`[compare]   ${id}: orphaned from catalogue`);
  }
}

console.log("");
console.log("[compare] ── Drift ──");
console.log(`[compare] Cluster changes: ${clusterChanges.length}`);
for (const c of clusterChanges) {
  console.log(`[compare]   ${c.id}: ${c.from} → ${c.to}`);
}

console.log(
  `[compare] Link count changes: ${linkDiffs.length} nodes differ by >3 links`
);
for (const d of linkDiffs) {
  console.log(
    `[compare]   ${d.id}: catalogue=${d.catalogue}, file=${d.file}`
  );
}
