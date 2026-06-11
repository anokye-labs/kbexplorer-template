import { describe, it, expect } from 'vitest';
import type { KBConfig, KBNode, NodeSourceFile } from '../../types';
import {
  canEditSource,
  resolveSourceFile,
  validateSourceContent,
  repoCoordsFromConfig,
  encodeRepoPath,
  buildEditUrl,
  buildNewFileUrl,
  buildHandoffUrl,
  buildUnifiedDiff,
  patchFilename,
  buildSourceEditHandoff,
} from '../source-edit';
import { buildContentModel } from '../content-model';
import { loadFixtureSource } from '../content-model/__tests__/fixtures';

const COORDS = { owner: 'anokye-labs', repo: 'kbexplorer-template', branch: 'main' };

function configWith(source: Partial<KBConfig['source']>): KBConfig {
  return { source: { owner: 'o', repo: 'r', branch: 'b', ...source } } as KBConfig;
}

function nodeWith(sourceFile?: NodeSourceFile): KBNode {
  return {
    id: 'n',
    title: 'n',
    cluster: 'person',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'structured', entityType: 'person' },
    sourceFile,
  };
}

// ── (a) the editor resolves a node's source-of-truth file content ──────────

describe('source-edit — resolving the source-of-truth file (F5 / #152)', () => {
  it('the content-model builder attaches the underlying file path + raw to entity nodes', () => {
    const graph = buildContentModel(loadFixtureSource());
    const ada = graph.nodes.find(n => n.id === 'kg://xbox.com/people/ada');
    expect(ada?.sourceFile).toBeDefined();
    // path is repo-relative (content-model root + entity path), never the URN
    expect(ada?.sourceFile?.path).toBe('content-model/people/ada.yaml');
    expect(ada?.sourceFile?.format).toBe('yaml');
    // raw is the verbatim file — editing it keeps the F2 mapping reversible
    expect(ada?.sourceFile?.raw).toContain('"@type": person');
    expect(ada?.sourceFile?.raw).toContain('name: Ada Okonkwo');
  });

  it('resolveSourceFile returns the file when present', () => {
    const file: NodeSourceFile = { path: 'content-model/people/ada.yaml', raw: 'id: ada\n', format: 'yaml' };
    expect(resolveSourceFile(nodeWith(file))).toEqual(file);
  });

  it('unresolved stub nodes carry no source file (nothing to edit)', () => {
    const graph = buildContentModel(loadFixtureSource());
    const cto = graph.nodes.find(n => n.id === 'kg://xbox.com/people/cto');
    expect(cto?.data?.unresolved).toBe(true);
    expect(cto?.sourceFile).toBeUndefined();
    expect(canEditSource(cto as KBNode)).toBe(false);
  });
});

// ── (b) the GitHub deep-link URL is constructed correctly ──────────────────

describe('source-edit — GitHub deep-link construction (F5 / #152)', () => {
  it('repoCoordsFromConfig reads owner/repo/branch and defaults branch to main', () => {
    expect(repoCoordsFromConfig(configWith({ owner: 'a', repo: 'b', branch: 'dev' })))
      .toEqual({ owner: 'a', repo: 'b', branch: 'dev' });
    expect(repoCoordsFromConfig(configWith({ owner: 'a', repo: 'b', branch: undefined })).branch).toBe('main');
    expect(repoCoordsFromConfig(configWith({ owner: 'a', repo: 'b', branch: '  ' })).branch).toBe('main');
  });

  it('builds the web-editor URL for an EXISTING file', () => {
    expect(buildEditUrl(COORDS, 'content-model/people/ada.yaml'))
      .toBe('https://github.com/anokye-labs/kbexplorer-template/edit/main/content-model/people/ada.yaml');
  });

  it('builds the create-file URL for a NEW file, pre-filled with path + content', () => {
    const url = buildNewFileUrl(COORDS, 'content-model/people/zoe.yaml', 'id: zoe\nname: Zoe\n');
    expect(url.startsWith('https://github.com/anokye-labs/kbexplorer-template/new/main?')).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('filename')).toBe('content-model/people/zoe.yaml');
    expect(params.get('value')).toBe('id: zoe\nname: Zoe\n');
  });

  it('buildHandoffUrl picks edit for existing files and new-file for new ones', () => {
    const path = 'content-model/people/ada.yaml';
    expect(buildHandoffUrl(COORDS, path, 'x', true)).toBe(buildEditUrl(COORDS, path));
    expect(buildHandoffUrl(COORDS, path, 'x', false)).toBe(buildNewFileUrl(COORDS, path, 'x'));
  });

  it('encodes path segments while preserving slashes', () => {
    expect(encodeRepoPath('content-model/squads/x cloud/a b.yaml'))
      .toBe('content-model/squads/x%20cloud/a%20b.yaml');
  });

  it('assembles a full handoff for an edited existing file', () => {
    const file: NodeSourceFile = { path: 'content-model/people/ada.yaml', raw: 'id: ada\n', format: 'yaml' };
    const handoff = buildSourceEditHandoff(COORDS, file, 'id: ada\nname: Ada\n');
    expect(handoff.changed).toBe(true);
    expect(handoff.exists).toBe(true);
    expect(handoff.url).toBe(buildEditUrl(COORDS, file.path));
    expect(handoff.newFileUrl).toContain('/new/main?');
    expect(handoff.patch).toContain('+name: Ada');
    expect(handoff.patchName).toBe('ada.yaml.patch');
  });

  it('reports no change when content is identical', () => {
    const file: NodeSourceFile = { path: 'a.yaml', raw: 'id: a\n', format: 'yaml' };
    const handoff = buildSourceEditHandoff(COORDS, file, 'id: a\n');
    expect(handoff.changed).toBe(false);
    expect(handoff.patch).toBe('');
  });

  it('is newline-agnostic: a CRLF checkout vs an LF textarea is not a spurious change', () => {
    // file.raw arrives with CRLF (Windows checkout); the textarea emits LF.
    const file: NodeSourceFile = { path: 'content-model/people/ada.yaml', raw: 'id: ada\r\nrole: Lead\r\n', format: 'yaml' };
    const unchanged = buildSourceEditHandoff(COORDS, file, 'id: ada\nrole: Lead\n');
    expect(unchanged.changed).toBe(false);
    expect(unchanged.patch).toBe('');
    // a genuine one-line edit yields a one-line diff, not a whole-file rewrite
    const edited = buildSourceEditHandoff(COORDS, file, 'id: ada\nrole: Principal Lead\n');
    expect(edited.changed).toBe(true);
    expect(edited.patch).toContain('-role: Lead');
    expect(edited.patch).toContain('+role: Principal Lead');
    expect(edited.patch).toContain(' id: ada');
  });

  it('patchFilename uses the file basename', () => {
    expect(patchFilename('content-model/squads/xcloud/streaming.yaml')).toBe('streaming.yaml.patch');
  });
});

// ── (c) invalid YAML/JSON is caught before handoff ─────────────────────────

describe('source-edit — validation before handoff (F5 / #152)', () => {
  it('accepts valid YAML', () => {
    expect(validateSourceContent('id: ada\nname: Ada\n', 'yaml')).toEqual({ ok: true });
  });

  it('rejects malformed YAML', () => {
    const result = validateSourceContent('id: ada\n  bad:\n: : :\n', 'yaml');
    expect(result.ok).toBe(false);
  });

  it('accepts valid JSON and rejects malformed JSON', () => {
    expect(validateSourceContent('{"id":"ada"}', 'json')).toEqual({ ok: true });
    expect(validateSourceContent('{"id":}', 'json').ok).toBe(false);
  });

  it('rejects empty content', () => {
    expect(validateSourceContent('   \n', 'yaml').ok).toBe(false);
  });
});

// ── (d) nodes without a source file expose no editor affordance ────────────

describe('source-edit — no affordance without a writable source (F5 / #152)', () => {
  it('canEditSource is false when sourceFile is absent', () => {
    expect(canEditSource(nodeWith(undefined))).toBe(false);
    expect(resolveSourceFile(nodeWith(undefined))).toBeNull();
  });

  it('canEditSource is false for an empty path or missing raw', () => {
    expect(canEditSource(nodeWith({ path: '', raw: 'x', format: 'yaml' }))).toBe(false);
    expect(canEditSource({ sourceFile: { path: 'a.yaml', format: 'yaml' } as NodeSourceFile })).toBe(false);
  });

  it('a README-style node (no sourceFile) is not editable', () => {
    const readme: KBNode = {
      id: 'readme', title: 'README', cluster: 'docs', content: '', rawContent: '',
      connections: [], source: { type: 'readme' },
    };
    expect(canEditSource(readme)).toBe(false);
  });
});

// ── unified diff fidelity ──────────────────────────────────────────────────

describe('source-edit — unified diff (F5 / #152)', () => {
  it('produces a git-style header and +/- lines for a single-field change', () => {
    const before = 'id: ada\nname: Ada\nrole: Lead\n';
    const after = 'id: ada\nname: Ada Okonkwo\nrole: Lead\n';
    const patch = buildUnifiedDiff('content-model/people/ada.yaml', before, after);
    expect(patch).toContain('diff --git a/content-model/people/ada.yaml b/content-model/people/ada.yaml');
    expect(patch).toContain('--- a/content-model/people/ada.yaml');
    expect(patch).toContain('+++ b/content-model/people/ada.yaml');
    expect(patch).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(patch).toContain('-name: Ada');
    expect(patch).toContain('+name: Ada Okonkwo');
    // unchanged lines are retained as context
    expect(patch).toContain(' id: ada');
    expect(patch).toContain(' role: Lead');
  });

  it('returns an empty patch when nothing changed', () => {
    expect(buildUnifiedDiff('a.yaml', 'x\n', 'x\n')).toBe('');
  });
});
