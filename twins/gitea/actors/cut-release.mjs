#!/usr/bin/env node
/**
 * Actor: create a Gitea release (non-draft, non-prerelease by default).
 *
 * Gitea releases map to the GitHub Releases API shape the app fetches via
 * `fetchReleases()`. Cutting a release here mutates the twin so the app
 * reflects the new release node on a cache-fresh load.
 *
 * Importable as `cutRelease()` or runnable as a CLI:
 *   node twins/gitea/actors/cut-release.mjs --tag v9.9.0 --name "DTU Release"
 */
import { coords, gitea } from '../gitea-client.mjs';
import { parseArgs, nonce } from './_args.mjs';

/**
 * @param {object} opts
 * @param {string} [opts.tag]        Tag name to create (default `dtu-v<nonce>`).
 * @param {string} [opts.name]       Release display name (default same as tag).
 * @param {string} [opts.body]       Release notes body.
 * @param {boolean} [opts.prerelease] Mark as pre-release (default false).
 * @param {string} [opts.target]     Target commit-ish for the tag (default `main`).
 */
export async function cutRelease({ tag, name, body, prerelease, target } = {}) {
  const { owner, repo, branch } = coords();
  const n = nonce();
  const tagName = tag ?? `dtu-v${n}`;
  const relName = name ?? tagName;
  const relBody = body ?? `DTU actor release ${n}. Validates release-node reflection on refresh.`;

  const res = await gitea('POST', `/repos/${owner}/${repo}/releases`, {
    tag_name: tagName,
    name: relName,
    body: relBody,
    draft: false,
    prerelease: Boolean(prerelease),
    target_commitish: target ?? branch,
  });

  if (!res.ok) {
    throw new Error(`cutRelease("${tagName}") failed: ${res.status} ${res.text}`);
  }

  return {
    tag: res.json.tag_name,
    name: res.json.name,
    id: res.json.id,
    url: res.json.html_url,
    prerelease: res.json.prerelease,
  };
}

if (process.argv[1]?.endsWith('cut-release.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  cutRelease({
    tag: args.tag,
    name: args.name,
    body: args.body,
    prerelease: args.prerelease === 'true' || args.prerelease === true,
    target: args.target,
  })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((err) => { console.error(`[cut-release] FAILED: ${err.message}`); process.exit(1); });
}
