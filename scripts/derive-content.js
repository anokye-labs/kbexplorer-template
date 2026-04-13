#!/usr/bin/env node
/**
 * derive-content.js — Identifies catalogue nodes that need content generation.
 *
 * Reads content/catalogue.json and reports which `derived: true` nodes
 * are missing authored content files, so the kb-writer agent knows what to generate.
 *
 * Usage:
 *   node scripts/derive-content.js          # summary list
 *   node scripts/derive-content.js --json   # machine-readable output
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const cataloguePath = resolve(root, "content", "catalogue.json");

if (!existsSync(cataloguePath)) {
  console.error("[derive] content/catalogue.json not found — run kb-architect first");
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(cataloguePath, "utf-8"));
const nodes = catalogue.nodes ?? [];

// A node needs generation when it is marked derived and doesn't already
// have an authored content file that should be preserved.
const authored = [];
const needsGeneration = [];

for (const node of nodes) {
  const contentFile = resolve(root, "content", `${node.id}.md`);
  const contentExists = existsSync(contentFile);

  if (node.authored) {
    authored.push(node);
    continue;
  }

  if (node.derived) {
    // If a content file exists, check whether it was previously authored
    if (contentExists) {
      const raw = readFileSync(contentFile, "utf-8");
      // If frontmatter contains authored: true, treat it as authored and skip
      if (/^authored:\s*true/m.test(raw)) {
        authored.push(node);
        continue;
      }
    }
    needsGeneration.push(node);
  }
}

const jsonMode = process.argv.includes("--json");

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        total: nodes.length,
        authored: authored.length,
        derived: needsGeneration.length,
        nodes: needsGeneration.map((n) => ({
          id: n.id,
          title: n.title,
          cluster: n.cluster,
          file: n.file,
          prompt: n.prompt,
          edgeHints: n.edgeHints,
        })),
      },
      null,
      2
    )
  );
} else {
  console.log(
    `[derive] ${nodes.length} catalogue nodes, ${authored.length} authored, ${needsGeneration.length} need generation:`
  );
  for (const n of needsGeneration) {
    console.log(`  - ${n.id} (${n.file})`);
  }
  if (needsGeneration.length === 0) {
    console.log("  (none — all nodes have content)");
  }
}
