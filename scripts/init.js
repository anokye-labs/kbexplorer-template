#!/usr/bin/env node

/**
 * Interactive init script for kbexplorer.
 * Detects whether running in self-hosted mode (kbexplorer repo itself) or
 * submodule mode (embedded in another repo). Asks the user configuration
 * questions and sets up everything needed to run the explorer.
 *
 * Zero external dependencies — uses only node: built-ins.
 */

import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const kbRoot = resolve(__dirname, '..');
const hostRoot = resolve(kbRoot, '..', '..');

// ── Helpers ────────────────────────────────────────────────

function createPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    async ask(question, defaultValue) {
      return new Promise((res) => {
        const suffix = defaultValue != null ? ` [${defaultValue}]` : '';
        rl.question(`${question}${suffix}: `, (answer) => {
          res(answer.trim() || defaultValue || '');
        });
      });
    },
    async choose(question, options, defaultIndex = 0) {
      console.log(`\n${question}`);
      options.forEach((opt, i) => {
        const marker = i === defaultIndex ? '→' : ' ';
        console.log(`  ${marker} ${i + 1}. ${opt}`);
      });
      const answer = await this.ask(`Choose (1-${options.length})`, String(defaultIndex + 1));
      const idx = parseInt(answer, 10) - 1;
      return idx >= 0 && idx < options.length ? idx : defaultIndex;
    },
    async confirm(question, defaultYes = true) {
      const hint = defaultYes ? 'Y/n' : 'y/N';
      const answer = await this.ask(`${question} (${hint})`);
      if (!answer) return defaultYes;
      return answer.toLowerCase().startsWith('y');
    },
    close() {
      rl.close();
    },
  };
}

function detectGitRemote() {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: hostRoot,
      encoding: 'utf-8',
    }).trim();

    // Handle SSH: git@github.com:owner/repo.git
    const sshMatch = remote.match(/git@[^:]+:([^/]+)\/([^/.]+)/);
    if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

    // Handle HTTPS: https://github.com/owner/repo.git
    const httpsMatch = remote.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  } catch {
    // Not a git repo or no remote
  }
  return null;
}

function detectBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: hostRoot,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return 'main';
  }
}

function isSelfHosted() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(hostRoot, 'package.json'), 'utf-8'));
    if (pkg.name === 'kbexplorer') return true;
  } catch {
    // no package.json or parse error
  }

  const remote = detectGitRemote();
  if (remote && remote.repo.toLowerCase() === 'kbexplorer') return true;

  return kbRoot === hostRoot;
}

function writeEnvFile(config) {
  const lines = [
    `VITE_KB_OWNER=${config.owner}`,
    `VITE_KB_REPO=${config.repo}`,
    `VITE_KB_BRANCH=${config.branch}`,
    `VITE_KB_TITLE=${config.title}`,
  ];
  if (config.path) {
    lines.push(`VITE_KB_PATH=${config.path}`);
  }

  const envPath = resolve(config.envDir, '.env.kbexplorer');
  writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  console.log(`\n✓ Created ${envPath}`);
}

function writeConfigYaml(config) {
  const contentDir = config.path || 'content';
  const configDir = resolve(hostRoot, contentDir);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const yaml = `title: "${config.title}"
subtitle: "${config.subtitle}"
author: "${config.author}"

source:
  owner: ${config.owner}
  repo: ${config.repo}
${config.path ? `  path: ${config.path}\n` : ''}  branch: ${config.branch}

clusters:
  feature:
    name: Feature
    color: "#4A9CC8"
  task:
    name: Task
    color: "#8CB050"
  bug:
    name: Bug
    color: "#C04040"
  epic:
    name: Epic
    color: "#E8A838"
  code:
    name: Code
    color: "#9A8A78"
  docs:
    name: Documentation
    color: "#D4A050"

visuals:
  mode: ${config.visualMode}
  fallback: emoji

theme:
  default: ${config.theme}

graph:
  physics: true
  layout: force-atlas-2

features:
  hud: ${config.features.hud}
  minimap: ${config.features.minimap}
  readingTools: ${config.features.readingTools}
  keyboardNav: ${config.features.keyboardNav}
  sparkAnimation: false
`;

  const configPath = resolve(configDir, 'config.yaml');
  writeFileSync(configPath, yaml, 'utf-8');
  console.log(`✓ Created ${configPath}`);
}

function addNpmScripts(selfHosted) {
  const pkgPath = resolve(hostRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    console.log('⚠ No package.json found — skipping npm script injection');
    return;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.scripts = pkg.scripts || {};

  if (selfHosted) {
    // Self-hosted mode: scripts run directly
    if (!pkg.scripts['kb:dev']) {
      pkg.scripts['kb:dev'] = 'vite --open';
    }
    if (!pkg.scripts['kb:build']) {
      pkg.scripts['kb:build'] = 'tsc -b && vite build';
    }
  } else {
    // Submodule mode: delegate to wrapper scripts
    const subDir = basename(resolve(kbRoot));
    const prefix = `.${subDir === '.kbexplorer' ? 'kbexplorer' : subDir}`;
    pkg.scripts['kb:dev'] = `node ${prefix}/scripts/dev.js`;
    pkg.scripts['kb:build'] = `node ${prefix}/scripts/build.js`;
    pkg.scripts['kb:install'] = `cd ${prefix} && npm install`;
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`✓ Updated ${pkgPath} with kb:dev, kb:build scripts`);
}

function updateGitignore() {
  const gitignorePath = resolve(hostRoot, '.gitignore');
  const entry = '.env.kbexplorer';

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (content.includes(entry)) return;
    writeFileSync(gitignorePath, content.trimEnd() + '\n' + entry + '\n', 'utf-8');
  } else {
    writeFileSync(gitignorePath, entry + '\n', 'utf-8');
  }
  console.log(`✓ Added ${entry} to .gitignore`);
}

function scaffoldStarterContent(contentPath) {
  const dir = resolve(hostRoot, contentPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const examplePath = resolve(dir, 'getting-started.md');
  if (!existsSync(examplePath)) {
    writeFileSync(
      examplePath,
      `---
id: getting-started
title: Getting Started
emoji: "🚀"
cluster: docs
connections: []
---

# Getting Started

Welcome to your knowledge base! Edit this file or add new markdown files to build your graph.

Each file becomes a node in the explorer. Use YAML frontmatter to define metadata,
connections, and clustering.
`,
      'utf-8',
    );
    console.log(`✓ Created starter content at ${examplePath}`);
  }
}

function installDependencies() {
  console.log('\n📦 Installing kbexplorer dependencies...');
  try {
    execSync('npm install --no-audit --no-fund', {
      cwd: kbRoot,
      stdio: 'inherit',
    });
    console.log('✓ Dependencies installed');
  } catch {
    console.error('⚠ Failed to install dependencies. Run `npm install` manually in the kbexplorer directory.');
  }
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  const selfHosted = isSelfHosted();
  const prompt = createPrompt();

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     kbexplorer — Interactive Setup       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (selfHosted) {
    console.log('📍 Self-hosted mode detected (running in the kbexplorer repo itself)');
  } else {
    console.log('📍 Submodule mode detected');
  }

  // Detect repo info
  const detected = detectGitRemote();
  const detectedBranch = detectBranch();

  const owner = await prompt.ask(
    'GitHub owner (org or username)',
    detected?.owner ?? '',
  );
  const repo = await prompt.ask('GitHub repo name', detected?.repo ?? '');
  const branch = await prompt.ask('Branch', detectedBranch);
  const title = await prompt.ask(
    'Knowledge base title',
    `${repo} Knowledge Base`,
  );
  const subtitle = await prompt.ask('Subtitle', 'Interactive Knowledge Base Explorer');
  const author = await prompt.ask('Author', owner);

  // Content mode
  const contentModeIdx = await prompt.choose(
    'What content should the explorer visualize?',
    [
      'Repo-aware — auto-discover issues, PRs, README, and file tree',
      'Authored — hand-curated markdown files with frontmatter',
      'Both — authored content plus repo artifacts',
    ],
    0,
  );

  let contentPath = undefined;
  if (contentModeIdx === 1 || contentModeIdx === 2) {
    contentPath = await prompt.ask('Content directory path', 'content');
  }

  // Visual mode
  const visualModes = ['emoji', 'sprites', 'heroes', 'none'];
  const visualIdx = await prompt.choose(
    'Visual identity mode for nodes:',
    [
      'emoji — Unicode emoji (lightweight, text-focused)',
      'sprites — Character illustrations',
      'heroes — Full-bleed photography',
      'none — Text only',
    ],
    0,
  );
  const visualMode = visualModes[visualIdx];

  // Theme
  const themes = ['dark', 'light', 'sepia'];
  const themeIdx = await prompt.choose(
    'Default theme:',
    ['dark', 'light', 'sepia'],
    0,
  );
  const theme = themes[themeIdx];

  // Features
  console.log('\nFeatures (press Enter for defaults):');
  const features = {
    hud: await prompt.confirm('Enable HUD (minimap + related nodes panel)?', true),
    minimap: await prompt.confirm('Enable minimap?', true),
    readingTools: await prompt.confirm('Enable reading tools?', true),
    keyboardNav: await prompt.confirm('Enable keyboard navigation?', true),
  };

  // Build config object
  const config = {
    owner,
    repo,
    branch,
    title,
    subtitle,
    author,
    path: contentPath,
    visualMode,
    theme,
    features,
    envDir: selfHosted ? kbRoot : hostRoot,
  };

  console.log('\n───────────────────────────────────────────');
  console.log('Setting up kbexplorer...\n');

  // Write config files
  writeEnvFile(config);
  writeConfigYaml(config);
  updateGitignore();

  // Scaffold authored content if applicable
  if (contentPath) {
    scaffoldStarterContent(contentPath);
  }

  // Add npm scripts
  addNpmScripts(selfHosted);

  // Install dependencies automatically
  if (!selfHosted) {
    installDependencies();
  }

  prompt.close();

  console.log('\n───────────────────────────────────────────');
  console.log('✅ kbexplorer is configured!');
  console.log('');
  console.log('The agent will now start the dev server and validate the setup.');
  console.log('───────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('Error during init:', err);
  process.exit(1);
});
