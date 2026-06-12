#!/usr/bin/env node
/**
 * Actor: edit a source-of-truth entity file on a fresh branch and open a PR.
 *
 * This mirrors the real multi-agent flow F5 is built for: an actor changes the
 * underlying YAML/JSON entity (NOT the JSON-LD projection), pushes a branch, and
 * opens a PR. Scenario specs then assert the app reflects the new PR node and,
 * after merge, the changed file on `main`.
 *
 * Importable as `editSource()` or runnable as a CLI:
 *   node twins/gitea/actors/edit-source.mjs --path content-model/people/ben.yaml --set title="Staff Engineer"
 */
import { coords, ensureBranch, getContents, putFile, ensurePull, gitea } from '../gitea-client.mjs';
import { parseArgs, nonce } from './_args.mjs';

/**
 * @param {object} opts
 * @param {string} [opts.path]   entity file to edit (default a person entity)
 * @param {Record<string,string>} [opts.set]  shallow `key: value` YAML overrides
 * @param {string} [opts.marker] comment marker appended when no `set` given
 * @param {string} [opts.title]  PR title
 */
export async function editSource({ path, set, marker, title } = {}) {
  const { owner, repo, branch } = coords();
  const targetPath = path ?? 'content-model/people/ben.yaml';
  const n = nonce();
  const prBranch = `dtu/edit-${n}`;

  await gitea('DELETE', `/repos/${owner}/${repo}/branches/${prBranch}`).catch(() => {});
  await ensureBranch(owner, repo, prBranch, branch);

  const current = await getContents(owner, repo, targetPath, prBranch);
  let content = current && current.content ? Buffer.from(current.content, 'base64').toString('utf8') : '';

  if (set && Object.keys(set).length) {
    for (const [key, value] of Object.entries(set)) {
      const line = `${key}: ${value}`;
      const re = new RegExp(`^${key}\\s*:.*$`, 'm');
      content = re.test(content) ? content.replace(re, line) : `${content.replace(/\s*$/, '')}\n${line}\n`;
    }
  } else {
    content = `${content.replace(/\s*$/, '')}\n# touched by DTU actor ${n}\n`;
  }

  await putFile(owner, repo, targetPath, {
    content,
    message: `DTU actor: edit ${targetPath} (${n})`,
    branch: prBranch,
  });

  const { pull } = await ensurePull(owner, repo, {
    title: title ?? `DTU actor edit ${n}`,
    head: prBranch,
    base: branch,
    body: `Source-of-truth edit to \`${targetPath}\` by the DTU actor harness.`,
  });

  return { pr: pull.number, branch: prBranch, path: targetPath, url: pull.html_url };
}

if (process.argv[1]?.endsWith('edit-source.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  const set = {};
  const sets = args.set ? (Array.isArray(args.set) ? args.set : [args.set]) : [];
  for (const s of sets) {
    const eq = String(s).indexOf('=');
    if (eq !== -1) set[s.slice(0, eq)] = s.slice(eq + 1);
  }
  editSource({ path: args.path, set, title: args.title })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((err) => { console.error(`[edit-source] FAILED: ${err.message}`); process.exit(1); });
}
