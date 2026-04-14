#!/usr/bin/env node
/**
 * enrich-context.js — Gathers issue, PR, and commit context for each
 * catalogue node by cross-referencing the manifest data.
 *
 * Produces an enriched catalogue where each node has:
 *   - relatedIssues: issues that reference the node's file or title
 *   - relatedPRs: PRs whose body mentions the file
 *   - recentCommits: commits that touched the file
 *
 * Usage: node scripts/enrich-context.js > content/catalogue-enriched.json
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const cataloguePath = resolve(root, 'content', 'catalogue.json');
const manifestPath = resolve(root, 'src', 'generated', 'repo-manifest.json');

if (!existsSync(cataloguePath)) {
  console.error('[enrich] content/catalogue.json not found');
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error('[enrich] src/generated/repo-manifest.json not found — run generate-manifest first');
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const issues = manifest.issues ?? [];
const prs = manifest.pullRequests ?? [];
const commits = manifest.commits ?? [];

console.error(`[enrich] ${issues.length} issues, ${prs.length} PRs, ${commits.length} commits`);

for (const node of catalogue.nodes) {
  const file = node.file ?? '';
  const fileBase = basename(file).replace(/\.\w+$/, '');
  const titleLower = (node.title ?? '').toLowerCase();
  const idLower = (node.id ?? '').toLowerCase();

  // Find issues that mention this node's file, title, or ID
  node.relatedIssues = [];
  for (const iss of issues) {
    const body = (iss.body ?? '').toLowerCase();
    const title = (iss.title ?? '').toLowerCase();
    if (
      (file && (body.includes(file) || body.includes(fileBase))) ||
      (titleLower && (body.includes(titleLower) || title.includes(titleLower))) ||
      (idLower && body.includes(idLower))
    ) {
      node.relatedIssues.push({
        number: iss.number,
        title: iss.title,
        state: iss.state,
        snippet: (iss.body ?? '').substring(0, 200).replace(/\n/g, ' '),
      });
    }
  }
  // Cap at 5 most relevant
  node.relatedIssues = node.relatedIssues.slice(0, 5);

  // Find PRs that mention this node's file or title
  node.relatedPRs = [];
  for (const pr of prs) {
    const body = (pr.body ?? '').toLowerCase();
    const title = (pr.title ?? '').toLowerCase();
    if (
      (file && (body.includes(file) || body.includes(fileBase))) ||
      (titleLower && (body.includes(titleLower) || title.includes(titleLower)))
    ) {
      node.relatedPRs.push({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        snippet: (pr.body ?? '').substring(0, 200).replace(/\n/g, ' '),
      });
    }
  }
  node.relatedPRs = node.relatedPRs.slice(0, 5);

  // Find commits that touched this file
  node.recentCommits = [];
  for (const c of commits) {
    const msg = (c.commit?.message ?? '').toLowerCase();
    if (
      (file && msg.includes(fileBase)) ||
      (titleLower.length > 5 && msg.includes(titleLower))
    ) {
      node.recentCommits.push({
        sha: c.sha?.substring(0, 7),
        message: c.commit?.message?.split('\n')[0] ?? '',
      });
    }
  }
  node.recentCommits = node.recentCommits.slice(0, 8);
}

// Write enriched catalogue
const outPath = resolve(root, 'content', 'catalogue-enriched.json');
writeFileSync(outPath, JSON.stringify(catalogue, null, 2));

// Summary
let withIssues = 0, withPRs = 0, withCommits = 0;
for (const n of catalogue.nodes) {
  if (n.relatedIssues?.length) withIssues++;
  if (n.relatedPRs?.length) withPRs++;
  if (n.recentCommits?.length) withCommits++;
}
console.error(`[enrich] Enriched ${catalogue.nodes.length} nodes:`);
console.error(`[enrich]   ${withIssues} have related issues`);
console.error(`[enrich]   ${withPRs} have related PRs`);
console.error(`[enrich]   ${withCommits} have related commits`);
console.error(`[enrich] Written to ${outPath}`);
