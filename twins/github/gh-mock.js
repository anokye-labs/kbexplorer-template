#!/usr/bin/env node
/**
 * gh CLI mock — serves fixture data instead of calling GitHub.
 * Usage: node twins/github/gh-mock.js issue list --json ...
 *    or: node twins/github/gh-mock.js pr list --json ...
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function loadFixture(name) {
  const p = resolve(__dirname, 'fixtures', name);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function parseFlag(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

// gh CLI uses camelCase keys; GitHub REST API uses snake_case.
// Map API fixture fields → gh CLI output fields.
function mapIssue(item) {
  return {
    number: item.number,
    title: item.title,
    body: item.body ?? '',
    state: item.state ?? 'open',
    url: item.html_url ?? '',
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
    labels: (item.labels ?? []).map((l) => ({
      name: l.name,
      color: l.color ?? '',
      description: l.description ?? '',
    })),
    assignees: (item.assignees ?? []).map((a) => ({
      login: a.login,
      id: a.id,
    })),
  };
}

function mapPull(item) {
  return {
    number: item.number,
    title: item.title,
    body: item.body ?? '',
    state: item.state ?? 'open',
    url: item.html_url ?? '',
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
    labels: (item.labels ?? []).map((l) => ({
      name: l.name,
      color: l.color ?? '',
      description: l.description ?? '',
    })),
  };
}

// Determine subcommand: issue list | pr list
const sub = args[0];
const action = args[1];

if (!sub || !action) {
  console.error('Usage: gh-mock.js <issue|pr> list --json <fields> [--state <state>] [--limit <n>]');
  process.exit(1);
}

if (action !== 'list') {
  console.error(`Unsupported action "${action}". Only "list" is implemented.`);
  process.exit(1);
}

let items;
if (sub === 'issue') {
  items = loadFixture('issues.json').map(mapIssue);
} else if (sub === 'pr') {
  items = loadFixture('pulls.json').map(mapPull);
} else {
  console.error(`Unknown subcommand "${sub}". Supported: issue, pr`);
  process.exit(1);
}

// --state filter (all | open | closed)
const stateFilter = parseFlag('--state');
if (stateFilter && stateFilter !== 'all') {
  items = items.filter((i) => i.state.toLowerCase() === stateFilter.toLowerCase());
}

// --limit
const limitStr = parseFlag('--limit');
if (limitStr) {
  const limit = parseInt(limitStr, 10);
  if (!Number.isNaN(limit) && limit > 0) {
    items = items.slice(0, limit);
  }
}

// --json field projection
const fieldsStr = parseFlag('--json');
if (fieldsStr) {
  const fields = fieldsStr.split(',').map((f) => f.trim());
  items = items.map((item) => {
    const out = {};
    for (const f of fields) {
      if (f in item) out[f] = item[f];
    }
    return out;
  });
}

process.stdout.write(JSON.stringify(items, null, 2) + '\n');
