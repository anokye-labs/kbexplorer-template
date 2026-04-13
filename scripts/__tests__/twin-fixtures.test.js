import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../twins/github/fixtures');
const GH_MOCK = resolve(__dirname, '../../twins/github/gh-mock.js');

// ── Direct fixture validation ─────────────────────────────

describe('twin fixture data', () => {
  it('issues fixture contains real issues (not PRs)', () => {
    const issues = JSON.parse(readFileSync(resolve(FIXTURES, 'issues.json'), 'utf8'));
    const realIssues = issues.filter((i) => !i.pull_request);
    expect(realIssues.length).toBeGreaterThan(0);
    for (const issue of realIssues) {
      expect(issue.number).toBeDefined();
      expect(issue.title).toBeDefined();
      expect(issue.state).toBeDefined();
    }
  });

  it('pulls fixture has required fields', () => {
    const prs = JSON.parse(readFileSync(resolve(FIXTURES, 'pulls.json'), 'utf8'));
    expect(prs.length).toBeGreaterThan(0);
    for (const pr of prs) {
      expect(pr.number).toBeDefined();
      expect(pr.title).toBeDefined();
      expect(pr.state).toBeDefined();
      expect(pr.html_url).toBeDefined();
    }
  });

  it('tree fixture has blobs and trees', () => {
    const tree = JSON.parse(readFileSync(resolve(FIXTURES, 'tree.json'), 'utf8'));
    expect(tree.tree).toBeDefined();
    expect(tree.tree.length).toBeGreaterThan(50);
    expect(tree.tree.some((e) => e.type === 'blob')).toBe(true);
    expect(tree.tree.some((e) => e.type === 'tree')).toBe(true);
  });
});

// ── gh-mock CLI invocation ────────────────────────────────

describe('gh-mock CLI', () => {
  it('produces valid JSON for issue list', () => {
    const { execSync } = require('node:child_process');
    const output = execSync(
      `node "${GH_MOCK}" issue list --json number,title,state --state all --limit 5`,
      { encoding: 'utf8' },
    );
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(5);
    expect(data[0]).toHaveProperty('number');
    expect(data[0]).toHaveProperty('title');
    expect(data[0]).toHaveProperty('state');
  });

  it('produces valid JSON for pr list', () => {
    const { execSync } = require('node:child_process');
    const output = execSync(
      `node "${GH_MOCK}" pr list --json number,title,state --state all --limit 5`,
      { encoding: 'utf8' },
    );
    const data = JSON.parse(output);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(5);
    expect(data[0]).toHaveProperty('number');
    expect(data[0]).toHaveProperty('title');
  });

  it('respects --state open filter', () => {
    const { execSync } = require('node:child_process');
    const output = execSync(
      `node "${GH_MOCK}" issue list --json number,state --state open --limit 200`,
      { encoding: 'utf8' },
    );
    const data = JSON.parse(output);
    for (const item of data) {
      expect(item.state.toLowerCase()).toBe('open');
    }
  });

  it('respects --limit', () => {
    const { execSync } = require('node:child_process');
    const output = execSync(
      `node "${GH_MOCK}" issue list --json number --state all --limit 3`,
      { encoding: 'utf8' },
    );
    const data = JSON.parse(output);
    expect(data.length).toBeLessThanOrEqual(3);
  });

  it('maps API snake_case fields to gh CLI camelCase', () => {
    const { execSync } = require('node:child_process');
    const output = execSync(
      `node "${GH_MOCK}" issue list --json number,title,createdAt,updatedAt,labels --state all --limit 1`,
      { encoding: 'utf8' },
    );
    const data = JSON.parse(output);
    const item = data[0];
    expect(item).toHaveProperty('createdAt');
    expect(item).toHaveProperty('updatedAt');
    expect(item).toHaveProperty('labels');
    expect(Array.isArray(item.labels)).toBe(true);
  });
});

// ── fetchLocalIssues / fetchLocalPullRequests via gh-mock ──

// Hoisted mock — intercepts execSync so `gh` commands route through gh-mock
vi.mock('node:child_process', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    execSync: vi.fn((cmd, opts) => {
      if (typeof cmd === 'string' && (cmd.startsWith('gh issue') || cmd.startsWith('gh pr'))) {
        const mockCmd = cmd.replace(/^gh /, `node "${GH_MOCK}" `);
        return mod.execSync(mockCmd, opts);
      }
      if (typeof cmd === 'string' && cmd.startsWith('gh --version')) {
        return 'gh-mock 0.0.0';
      }
      return mod.execSync(cmd, opts);
    }),
  };
});

describe('generate-manifest with gh-mock', () => {

  it('fetchLocalIssues returns mapped issues from fixtures', async () => {
    const { fetchLocalIssues } = await import('../generate-manifest.js');
    const issues = fetchLocalIssues();
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue).toHaveProperty('number');
      expect(issue).toHaveProperty('title');
      expect(typeof issue.state).toBe('string');
      expect(issue).toHaveProperty('labels');
      expect(issue).toHaveProperty('html_url');
    }
  });

  it('fetchLocalPullRequests returns mapped PRs from fixtures', async () => {
    const { fetchLocalPullRequests } = await import('../generate-manifest.js');
    const prs = fetchLocalPullRequests();
    expect(prs.length).toBeGreaterThan(0);
    for (const pr of prs) {
      expect(pr).toHaveProperty('number');
      expect(pr).toHaveProperty('title');
      expect(typeof pr.state).toBe('string');
      expect(pr).toHaveProperty('labels');
      expect(pr).toHaveProperty('html_url');
    }
  });

  it('issue labels are normalized to {name, color} shape', async () => {
    const { fetchLocalIssues } = await import('../generate-manifest.js');
    const issues = fetchLocalIssues();
    const withLabels = issues.filter((i) => i.labels.length > 0);
    expect(withLabels.length).toBeGreaterThan(0);
    for (const issue of withLabels) {
      for (const label of issue.labels) {
        expect(label).toHaveProperty('name');
        expect(label).toHaveProperty('color');
      }
    }
  });

  it('issue state is lowercased', async () => {
    const { fetchLocalIssues } = await import('../generate-manifest.js');
    const issues = fetchLocalIssues();
    for (const issue of issues) {
      expect(issue.state).toBe(issue.state.toLowerCase());
    }
  });
});
