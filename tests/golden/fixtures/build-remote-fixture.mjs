/**
 * Phase 0 / T0.2 — derive a recorded GitHub-API fixture from the committed
 * manifest fixture (`tests/golden/fixtures/manifest.json`).
 *
 * The manifest is itself a recording of this repo's GitHub API responses
 * (it's produced by `scripts/generate-manifest.js` and snapshotted here). This
 * script reshapes it into the response shapes the remote loader's API
 * functions return, so the remote-mode golden test can run hermetically (no
 * network): the test mocks `src/api` to serve from this fixture.
 *
 * Run: `node tests/golden/fixtures/build-remote-fixture.mjs`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, 'manifest.json');
const outPath = join(here, 'remote-api.json');

const m = JSON.parse(readFileSync(manifestPath, 'utf8'));

// The fixed source the remote-mode golden test resolves against.
const source = {
  owner: 'anokye-labs',
  repo: 'kbexplorer-template',
  path: 'content',
  branch: 'main',
};

// Repo-relative path → file content. Covers every path the remote loader may
// request via fetchFile / fetchFiles for this preset.
const files = {};
if (typeof m.readme === 'string') files['README.md'] = m.readme;
if (typeof m.configRaw === 'string') files[`${source.path}/config.yaml`] = m.configRaw;
if (typeof m.structuredNodeMapRaw === 'string') files['node-map.yaml'] = m.structuredNodeMapRaw;
for (const [path, content] of Object.entries(m.authoredContent ?? {})) files[path] = content;
for (const [path, content] of Object.entries(m.structuralFiles ?? {})) files[path] = content;
if (m.contentModel?.root && m.contentModel?.files) {
  for (const [path, content] of Object.entries(m.contentModel.files)) {
    files[`${m.contentModel.root}/${path}`] = content;
  }
}

const fixture = {
  source,
  issues: m.issues ?? [],
  pullRequests: m.pullRequests ?? [],
  commits: [],
  releases: [],
  tree: m.tree ?? [],
  files,
};

writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n');
console.log(
  `wrote ${outPath}: ${fixture.issues.length} issues, ${fixture.pullRequests.length} PRs, ` +
    `${fixture.tree.length} tree items, ${Object.keys(files).length} files`,
);
