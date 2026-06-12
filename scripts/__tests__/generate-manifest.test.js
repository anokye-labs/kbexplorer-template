import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import {
  walkFileSystem,
  readAuthoredContent,
  readConfig,
  readReadme,
  fetchLocalCommits,
  readContentModel,
  readThemeFile,
} from '../generate-manifest.js';

const FIXTURES = resolve(import.meta.dirname, '__fixtures__');

beforeAll(() => {
  // Create a minimal fixture directory tree
  mkdirSync(resolve(FIXTURES, 'src', 'engine'), { recursive: true });
  mkdirSync(resolve(FIXTURES, 'content', 'wiki'), { recursive: true });
  mkdirSync(resolve(FIXTURES, '.git'), { recursive: true });
  mkdirSync(resolve(FIXTURES, 'node_modules', 'foo'), { recursive: true });

  writeFileSync(resolve(FIXTURES, 'README.md'), '# Test Repo\n\nHello world.');
  writeFileSync(resolve(FIXTURES, 'package.json'), '{"name":"test-repo"}');
  writeFileSync(resolve(FIXTURES, 'src', 'App.tsx'), 'export default function App() {}');
  writeFileSync(resolve(FIXTURES, 'src', 'engine', 'graph.ts'), 'export function buildGraph() {}');
  writeFileSync(resolve(FIXTURES, '.git', 'config'), '[core]');
  writeFileSync(resolve(FIXTURES, 'node_modules', 'foo', 'index.js'), 'module.exports = {}');

  writeFileSync(resolve(FIXTURES, 'content', 'config.yaml'), 'title: "Test KB"\nclusters: {}');
  writeFileSync(resolve(FIXTURES, 'content', 'overview.md'), '---\nid: overview\ntitle: Overview\ncluster: docs\n---\n# Overview\nHello.');
  writeFileSync(resolve(FIXTURES, 'content', 'wiki', 'setup.md'), '---\nid: setup\ntitle: Setup Guide\ncluster: guide\n---\n# Setup\nSteps.');
});

afterAll(() => {
  rmSync(FIXTURES, { recursive: true, force: true });
});

// ── readContentModel ───────────────────────────────────────

describe('readContentModel (T2.4 / #163)', () => {
  it('returns null when no content-model directory exists', () => {
    expect(readContentModel(FIXTURES)).toBeNull();
  });

  it('reads a content-model tree into a flat { root, files } source', () => {
    const cmDir = resolve(FIXTURES, 'content-model');
    mkdirSync(resolve(cmDir, 'schema'), { recursive: true });
    mkdirSync(resolve(cmDir, 'people'), { recursive: true });
    writeFileSync(resolve(cmDir, 'teamops.yaml'), 'authority: xbox.com\ndefaultOrg: personalization');
    writeFileSync(resolve(cmDir, 'schema', 'edges.yaml'), 'edges: {}');
    writeFileSync(resolve(cmDir, 'people', 'ada.yaml'), '"@type": person\nid: ada');

    const source = readContentModel(FIXTURES);
    expect(source).not.toBeNull();
    expect(source.root).toBe('content-model');
    expect(source.files['teamops.yaml']).toContain('authority: xbox.com');
    expect(source.files['schema/edges.yaml']).toBe('edges: {}');
    expect(source.files['people/ada.yaml']).toContain('@type');

    rmSync(cmDir, { recursive: true, force: true });
  });

  it('returns null for an empty content-model directory', () => {
    const cmDir = resolve(FIXTURES, 'content-model-empty');
    mkdirSync(cmDir, { recursive: true });
    expect(readContentModel(FIXTURES, 'content-model-empty')).toBeNull();
    rmSync(cmDir, { recursive: true, force: true });
  });
});

// ── readThemeFile (T5.1 / #199) ────────────────────────────

describe('readThemeFile (T5.1 / #199)', () => {
  it('returns null when config has no theme.themesFile', () => {
    expect(readThemeFile(FIXTURES, 'title: "Test KB"\nclusters: {}')).toBeNull();
  });

  it('returns null for null/unparseable config', () => {
    expect(readThemeFile(FIXTURES, null)).toBeNull();
    expect(readThemeFile(FIXTURES, 'themes: {oops: ')).toBeNull();
  });

  it('reads the repo-relative theme file referenced by theme.themesFile', () => {
    mkdirSync(resolve(FIXTURES, 'content', 'themes'), { recursive: true });
    writeFileSync(
      resolve(FIXTURES, 'content', 'themes', 'extra.yaml'),
      'themes:\n  forest:\n    brand: "#2E7D32"',
    );
    const configRaw = 'theme:\n  default: dark\n  themesFile: content/themes/extra.yaml';
    const raw = readThemeFile(FIXTURES, configRaw);
    expect(raw).toContain('forest');
    expect(raw).toContain('#2E7D32');
    rmSync(resolve(FIXTURES, 'content', 'themes'), { recursive: true, force: true });
  });

  it('returns null when the referenced theme file does not exist', () => {
    const configRaw = 'theme:\n  themesFile: content/themes/missing.yaml';
    expect(readThemeFile(FIXTURES, configRaw)).toBeNull();
  });
});

// ── walkFileSystem ─────────────────────────────────────────

describe('walkFileSystem', () => {
  it('produces entries for files and directories', () => {
    const tree = walkFileSystem(FIXTURES);
    expect(tree.length).toBeGreaterThan(0);
    expect(tree.some(e => e.path === 'README.md' && e.type === 'blob')).toBe(true);
    expect(tree.some(e => e.path === 'src' && e.type === 'tree')).toBe(true);
    expect(tree.some(e => e.path === 'src/App.tsx' && e.type === 'blob')).toBe(true);
  });

  it('includes nested directories', () => {
    const tree = walkFileSystem(FIXTURES);
    expect(tree.some(e => e.path === 'src/engine' && e.type === 'tree')).toBe(true);
    expect(tree.some(e => e.path === 'src/engine/graph.ts' && e.type === 'blob')).toBe(true);
  });

  it('filters out .git directory', () => {
    const tree = walkFileSystem(FIXTURES);
    expect(tree.some(e => e.path.startsWith('.git'))).toBe(false);
  });

  it('filters out node_modules', () => {
    const tree = walkFileSystem(FIXTURES);
    expect(tree.some(e => e.path.startsWith('node_modules'))).toBe(false);
  });

  it('includes file sizes for blobs', () => {
    const tree = walkFileSystem(FIXTURES);
    const readme = tree.find(e => e.path === 'README.md');
    expect(readme).toBeDefined();
    expect(readme?.size).toBeGreaterThan(0);
  });

  it('returns empty array for non-existent directory', () => {
    const tree = walkFileSystem(resolve(FIXTURES, 'nonexistent'));
    expect(tree).toEqual([]);
  });
});

// ── readAuthoredContent ────────────────────────────────────

describe('readAuthoredContent', () => {
  it('reads markdown files from content directory', () => {
    const content = readAuthoredContent(resolve(FIXTURES, 'content'), 'content');
    expect(Object.keys(content).length).toBe(2); // overview.md + wiki/setup.md
  });

  it('keys files by their relative path', () => {
    const content = readAuthoredContent(resolve(FIXTURES, 'content'), 'content');
    expect(content['content/overview.md']).toContain('# Overview');
  });

  it('reads nested directory content', () => {
    const content = readAuthoredContent(resolve(FIXTURES, 'content'), 'content');
    const setupKey = Object.keys(content).find(k => k.includes('setup.md'));
    expect(setupKey).toBeDefined();
    if (setupKey) {
      expect(content[setupKey]).toContain('# Setup');
    }
  });

  it('ignores non-md files', () => {
    writeFileSync(resolve(FIXTURES, 'content', 'notes.txt'), 'not markdown');
    const content = readAuthoredContent(resolve(FIXTURES, 'content'), 'content');
    expect(Object.keys(content).every(k => k.endsWith('.md'))).toBe(true);
    rmSync(resolve(FIXTURES, 'content', 'notes.txt'));
  });

  it('returns empty for non-existent directory', () => {
    const content = readAuthoredContent(resolve(FIXTURES, 'missing'), 'missing');
    expect(content).toEqual({});
  });
});

// ── readConfig ─────────────────────────────────────────────

describe('readConfig', () => {
  it('reads config.yaml from content directory', () => {
    const config = readConfig(FIXTURES, 'content');
    expect(config).toContain('title: "Test KB"');
  });

  it('returns null when config does not exist', () => {
    const config = readConfig(FIXTURES, 'nonexistent');
    expect(config).toBeNull();
  });
});

// ── readReadme ─────────────────────────────────────────────

describe('readReadme', () => {
  it('reads README.md from root', () => {
    const readme = readReadme(FIXTURES);
    expect(readme).toBe('# Test Repo\n\nHello world.');
  });

  it('returns null when README does not exist', () => {
    const readme = readReadme(resolve(FIXTURES, 'src'));
    expect(readme).toBeNull();
  });
});

// ── fetchLocalCommits ──────────────────────────────────────

describe('fetchLocalCommits', () => {
  it('returns an array (may be empty in test env)', () => {
    const commits = fetchLocalCommits();
    expect(Array.isArray(commits)).toBe(true);
  });

  it('commit objects have expected shape when present', () => {
    const commits = fetchLocalCommits();
    if (commits.length > 0) {
      expect(commits[0]).toHaveProperty('sha');
      expect(commits[0]).toHaveProperty('commit.message');
      expect(commits[0]).toHaveProperty('commit.author.name');
    }
  });
});

// ── Full manifest generation ───────────────────────────────

describe('generateManifest (integration)', () => {
  it('generates a valid manifest file', async () => {
    const { generateManifest } = await import('../generate-manifest.js');
    const manifest = generateManifest(FIXTURES);

    expect(manifest.tree.length).toBeGreaterThan(0);
    expect(manifest.readme).toBe('# Test Repo\n\nHello world.');
    expect(manifest.configRaw).toContain('title: "Test KB"');
    expect(Object.keys(manifest.authoredContent).length).toBe(2);
    expect(manifest.generatedAt).toBeDefined();
    expect(Array.isArray(manifest.issues)).toBe(true);
    expect(Array.isArray(manifest.pullRequests)).toBe(true);
    expect(Array.isArray(manifest.commits)).toBe(true);
    expect(manifest.contentModel).toBeNull();
  });
});
