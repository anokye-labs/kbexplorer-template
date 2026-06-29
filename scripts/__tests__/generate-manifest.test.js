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
  resolveStructuredContentPath,
  readThemeFile,
  detectHostRoot,
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

// ── detectHostRoot (#220) ──────────────────────────────────

describe('detectHostRoot (#220 host-root detection)', () => {
  const HR = resolve(FIXTURES, '__hostroot__');

  /** Create a directory with an optional package.json name and/or .git marker. */
  function makeDir(path, { pkgName, git } = {}) {
    mkdirSync(path, { recursive: true });
    if (pkgName !== undefined) {
      writeFileSync(resolve(path, 'package.json'), JSON.stringify({ name: pkgName }));
    }
    if (git) writeFileSync(resolve(path, '.git'), 'gitdir: ../.git/modules/x');
    return path;
  }

  afterAll(() => {
    rmSync(HR, { recursive: true, force: true });
  });

  it('honors an explicit VITE_KB_HOST_ROOT override regardless of layout', () => {
    const override = makeDir(resolve(HR, 'explicit-host'), { pkgName: 'whatever', git: true });
    // kbRootDir is irrelevant when the override is set.
    const result = detectHostRoot(resolve(HR, 'does-not-matter'), {
      VITE_KB_HOST_ROOT: override,
    });
    expect(result).toBe(resolve(override));
  });

  it('ignores a blank/whitespace-only VITE_KB_HOST_ROOT override', () => {
    const standalone = makeDir(resolve(HR, 'standalone-blank'), { pkgName: 'kbexplorer-template' });
    expect(detectHostRoot(standalone, { VITE_KB_HOST_ROOT: '   ' })).toBe(standalone);
  });

  it('detects the host root for a VENDORED layout (.kbexplorer one level deep)', () => {
    // host/ (git + package.json) containing host/.kbexplorer/ (the template)
    const host = makeDir(resolve(HR, 'vendored-host'), { pkgName: 'my-host-repo', git: true });
    const kb = makeDir(resolve(host, '.kbexplorer'), { pkgName: 'kbexplorer-template' });
    expect(detectHostRoot(kb, {})).toBe(host);
  });

  it('detects the host root for a SUBMODULE layout (deeper nesting)', () => {
    // host/ (git + pkg) → host/vendor/ (no boundary) → host/vendor/.kbexplorer/
    const host = makeDir(resolve(HR, 'submodule-host'), { pkgName: 'my-host-repo', git: true });
    makeDir(resolve(host, 'vendor'));
    const kb = makeDir(resolve(host, 'vendor', '.kbexplorer'), { pkgName: 'kbexplorer' });
    expect(detectHostRoot(kb, {})).toBe(host);
  });

  it('walks past a kbexplorer-named ancestor to the real host boundary', () => {
    // Defensive: an enclosing dir whose package.json is also a template name
    // must not be treated as the host.
    const host = makeDir(resolve(HR, 'nested-host'), { pkgName: 'real-host', git: true });
    const inner = makeDir(resolve(host, 'kbexplorer'), { pkgName: 'kbexplorer' });
    const kb = makeDir(resolve(inner, '.kbexplorer'), { pkgName: 'kbexplorer-template' });
    expect(detectHostRoot(kb, {})).toBe(host);
  });

  it('returns the template root for a STANDALONE template checkout', () => {
    // Template dir not named `.kbexplorer` → no enclosing host is inferred,
    // even if some unrelated repo happens to sit above it.
    makeDir(resolve(HR, 'workspace'), { pkgName: 'unrelated-parent', git: true });
    const standalone = makeDir(resolve(HR, 'workspace', 'kbexplorer-template'), {
      pkgName: 'kbexplorer-template',
      git: true,
    });
    expect(detectHostRoot(standalone, {})).toBe(standalone);
  });

  it('returns the given root when it is not the kbexplorer template', () => {
    const notTemplate = makeDir(resolve(HR, '.kbexplorer-imposter'), { pkgName: 'something-else' });
    expect(detectHostRoot(notTemplate, {})).toBe(notTemplate);
  });
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

  it('reads a configured alternate structured-content tree', () => {
    const cmDir = resolve(FIXTURES, 'docs', 'team-model');
    mkdirSync(resolve(cmDir, 'index'), { recursive: true });
    mkdirSync(resolve(cmDir, 'people'), { recursive: true });
    writeFileSync(resolve(cmDir, 'teamops.yaml'), 'authority: xbox.com\ndefaultOrg: personalization');
    writeFileSync(resolve(cmDir, 'index', 'context.jsonld'), '{"@context":{"person":"kg://xbox.com/people/"}}');
    writeFileSync(resolve(cmDir, 'people', 'ada.yaml'), '"@type": person\nid: ada');

    const source = readContentModel(FIXTURES, 'docs/team-model');
    expect(source).not.toBeNull();
    expect(source.root).toBe('docs/team-model');
    expect(source.files['teamops.yaml']).toContain('authority: xbox.com');
    expect(source.files['index/context.jsonld']).toContain('kg://xbox.com/people/');
    expect(source.files['people/ada.yaml']).toContain('@type');

    rmSync(resolve(FIXTURES, 'docs'), { recursive: true, force: true });
  });

  it('resolves structured-content path from env, config, then default', () => {
    const configRaw = 'structuredContent:\n  path: docs/team-model\n';
    expect(resolveStructuredContentPath(configRaw, {})).toBe('docs/team-model');
    expect(resolveStructuredContentPath(configRaw, {
      VITE_KB_STRUCTURED_CONTENT_PATH: 'ops/model',
    })).toBe('ops/model');
    expect(resolveStructuredContentPath(configRaw, {
      VITE_KB_CONTENT_MODEL_PATH: 'legacy/model',
    })).toBe('legacy/model');
    expect(resolveStructuredContentPath('title: Test KB\n', {})).toBe('content-model');
  });

  it('rejects Windows absolute structured-content paths on every host', () => {
    expect(resolveStructuredContentPath('structuredContent:\n  path: C:\\tmp\\model\n', {})).toBe('content-model');
    expect(resolveStructuredContentPath('title: Test KB\n', {
      VITE_KB_STRUCTURED_CONTENT_PATH: 'C:\\tmp\\model',
    })).toBe('content-model');
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

  it('rejects path traversal and absolute paths (stays inside repo root)', () => {
    // A traversal that escapes the repo root must be refused even if it resolves
    // to a real file, so secrets outside the project can't be embedded.
    writeFileSync(resolve(FIXTURES, '..', '__outside-theme.yaml'), 'themes:\n  evil: {}');
    try {
      expect(readThemeFile(FIXTURES, 'theme:\n  themesFile: ../__outside-theme.yaml')).toBeNull();
      const abs = resolve(FIXTURES, '..', '__outside-theme.yaml');
      expect(readThemeFile(FIXTURES, `theme:\n  themesFile: ${abs}`)).toBeNull();
    } finally {
      rmSync(resolve(FIXTURES, '..', '__outside-theme.yaml'), { force: true });
    }
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
