#!/usr/bin/env node
/**
 * Actor: merge a pull request, advancing `main` so the app reflects the change.
 *
 *   node twins/gitea/actors/merge-pr.mjs --number 6 --style merge
 */
import { coords, mergePull, listPulls } from '../gitea-client.mjs';
import { parseArgs } from './_args.mjs';

export async function mergePr({ number, style } = {}) {
  const { owner, repo } = coords();
  if (!number) throw new Error('merge-pr requires --number');
  const result = await mergePull(owner, repo, number, { style: style ?? 'merge' });
  return { merged: result.merged, number };
}

if (process.argv[1]?.endsWith('merge-pr.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  const number = args.number ? Number(args.number) : undefined;
  mergePr({ number, style: args.style })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((err) => { console.error(`[merge-pr] FAILED: ${err.message}`); process.exit(1); });
}

export { listPulls };
