#!/usr/bin/env node
/**
 * Actor: open a new issue in the Gitea twin.
 *
 * Each invocation creates a *new* issue (unique title by default) so scenario
 * specs can assert "a new work node appears after refresh". Importable as
 * `openIssue()` or runnable as a CLI:
 *
 *   node twins/gitea/actors/open-issue.mjs --title "Investigate flaky layout" --label bug
 */
import { coords, createIssue } from '../gitea-client.mjs';
import { parseArgs, nonce } from './_args.mjs';

export async function openIssue({ title, body, labels } = {}) {
  const { owner, repo } = coords();
  const issue = await createIssue(owner, repo, {
    title: title ?? `DTU actor issue ${nonce()}`,
    body: body ?? 'Opened by the DTU actor harness.',
    labels: labels ?? [],
  });
  return { number: issue.number, title: issue.title, url: issue.html_url };
}

if (process.argv[1]?.endsWith('open-issue.mjs')) {
  const args = parseArgs(process.argv.slice(2));
  const labels = args.label ? (Array.isArray(args.label) ? args.label : [args.label]) : [];
  openIssue({ title: args.title, body: args.body, labels })
    .then((r) => console.log(JSON.stringify(r)))
    .catch((err) => { console.error(`[open-issue] FAILED: ${err.message}`); process.exit(1); });
}
