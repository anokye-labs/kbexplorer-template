import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS_ROOT = join(REPO_ROOT, 'packages', 'template-contracts', 'src');
const TEMPLATE_ROOTS = [
  join(REPO_ROOT, 'packages', 'template-atlas'),
  join(REPO_ROOT, 'packages', 'template-brief'),
  join(REPO_ROOT, 'packages', 'template-field-guide'),
];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const toRepoRelative = (filePath: string): string =>
  relative(REPO_ROOT, filePath).split(sep).join('/');

const walkSourceFiles = (root: string): string[] => {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
};

const getImportSpecifiers = (source: string): string[] => {
  const specifiers: string[] = [];
  const regex = /(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]|(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(regex)) {
    specifiers.push(match[1] ?? match[2] ?? '');
  }
  return specifiers.filter(Boolean);
};

const resolveSpecifier = (fromFile: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null;

  const basePath = resolve(dirname(fromFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    join(basePath, 'index.ts'),
    join(basePath, 'index.tsx'),
    join(basePath, 'index.js'),
    join(basePath, 'index.jsx'),
    join(basePath, 'index.mjs'),
    join(basePath, 'index.cjs'),
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? null;
};

const templatePackageNameFromRoot = (templateRoot: string): string =>
  `@anokye-labs/kbexplorer-${toRepoRelative(templateRoot).replace('packages/', '')}`;

const isForbiddenTemplateImport = (templateRoot: string, fromFile: string, specifier: string): boolean => {
  if (specifier === 'src/engine' || specifier.startsWith('src/engine/')) return true;
  if (specifier.includes('/src/engine/')) return true;
  if (specifier.startsWith('@anokye-labs/kbexplorer-engine/')) return true;

  if (
    specifier.startsWith('@anokye-labs/kbexplorer-template-') &&
    specifier !== '@anokye-labs/kbexplorer-template-contracts'
  ) {
    const selfPackageName = templatePackageNameFromRoot(templateRoot);
    if (specifier === selfPackageName || specifier.startsWith(`${selfPackageName}/`)) {
      if (specifier.includes('/src/') || specifier.includes('/test/')) return true;
      return false;
    }

    if (specifier.includes('/src/') || specifier.includes('/test/')) return true;
    return specifier !== '@anokye-labs/kbexplorer-template-contracts';
  }

  const resolved = resolveSpecifier(fromFile, specifier);
  if (!resolved) return false;

  const resolvedRelative = toRepoRelative(resolved);
  if (resolvedRelative.startsWith('src/engine/')) return true;
  if (resolvedRelative.startsWith('src/representation/targets/')) return true;
  return !resolved.startsWith(templateRoot);
};

describe('template workspace dependency boundaries', () => {
  it('flags representative forbidden imports', () => {
    const atlasRoot = TEMPLATE_ROOTS[0];
    const atlasSourceFile = join(atlasRoot, 'src', 'App.tsx');

    expect(isForbiddenTemplateImport(atlasRoot, atlasSourceFile, '../../../src/engine/index.ts')).toBe(true);
    expect(
      isForbiddenTemplateImport(
        atlasRoot,
        atlasSourceFile,
        '@anokye-labs/kbexplorer-template-brief/src/template',
      ),
    ).toBe(true);
    expect(isForbiddenTemplateImport(atlasRoot, atlasSourceFile, './template')).toBe(false);
  });

  for (const templateRoot of TEMPLATE_ROOTS) {
    for (const filePath of walkSourceFiles(templateRoot)) {
      it(`${toRepoRelative(filePath)} keeps presentation-only imports`, () => {
        const source = readFileSync(filePath, 'utf8');
        const violations = getImportSpecifiers(source).filter(specifier =>
          isForbiddenTemplateImport(templateRoot, filePath, specifier),
        );
        expect(
          violations,
          `${toRepoRelative(filePath)} has forbidden imports: ${violations.join(', ')}`,
        ).toEqual([]);
      });
    }
  }
});

describe('shared presentation contracts stay DOM-agnostic', () => {
  const forbiddenTokens = ['window', 'document', 'HTMLElement', 'import.meta.env'];

  for (const filePath of walkSourceFiles(CONTRACTS_ROOT)) {
    it(`${toRepoRelative(filePath)} avoids DOM assumptions`, () => {
      const source = readFileSync(filePath, 'utf8');
      const violations = forbiddenTokens.filter(token => source.includes(token));
      expect(violations, `${toRepoRelative(filePath)} uses forbidden DOM tokens: ${violations.join(', ')}`).toEqual([]);
    });
  }
});
