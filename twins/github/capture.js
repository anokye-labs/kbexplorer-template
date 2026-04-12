#!/usr/bin/env node
/**
 * Capture real GitHub API responses into fixture files for the twin server.
 * Usage: node twins/github/capture.js <owner> <repo>
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures');

const [owner, repo] = process.argv.slice(2);
if (!owner || !repo) {
  console.error('Usage: node capture.js <owner> <repo>');
  process.exit(1);
}

// Resolve auth token: env var first, then gh CLI
let token;
try {
  token =
    process.env.GITHUB_TOKEN ||
    execSync('gh auth token', { encoding: 'utf8' }).trim();
} catch {
  console.warn('⚠  No GITHUB_TOKEN and gh CLI unavailable — using anonymous requests');
}

async function ghFetch(path) {
  const url = `https://api.github.com${path}`;
  const headers = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'kbexplorer-twin-capture' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${url}`);
  }
  return { data: await res.json(), headers: res.headers };
}

async function ghFetchPaginated(path) {
  const all = [];
  let page = 1;
  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const { data } = await ghFetch(`${path}${sep}page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    page++;
  }
  return all;
}

function save(name, data) {
  const dest = resolve(FIXTURES, name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? ` (${data.length} items)` : '';
  console.log(`  ✓ ${name}${count}`);
}

console.log(`\nCapturing fixtures for ${owner}/${repo}…\n`);

const base = `/repos/${owner}/${repo}`;

// Tree
const { data: tree } = await ghFetch(`${base}/git/trees/main?recursive=1`);
save('tree.json', tree);

// Issues (paginated)
const issues = await ghFetchPaginated(`${base}/issues?state=all&per_page=100`);
save('issues.json', issues);

// Pulls (paginated)
const pulls = await ghFetchPaginated(`${base}/pulls?state=all&per_page=100`);
save('pulls.json', pulls);

// Commits
const { data: commits } = await ghFetch(`${base}/commits?sha=main&per_page=50`);
save('commits.json', commits);

// File contents
const fileTargets = ['README.md', 'content/config.yaml'];
for (const filePath of fileTargets) {
  try {
    const { data } = await ghFetch(`${base}/contents/${filePath}`);
    const encoded = filePath.replace(/\//g, '%2F');
    save(`files/${encoded}.json`, data);
  } catch (err) {
    console.log(`  ⚠ files/${filePath} — ${err.message}`);
  }
}

console.log('\nDone.\n');
