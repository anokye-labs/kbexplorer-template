/**
 * Phase 0 / T0.1+T0.2 — record the external Wikipedia summaries the
 * `WikipediaProvider` fetches, so the golden builds are hermetic.
 *
 * The provider hits `en.wikipedia.org/api/rest_v1/page/summary/<title>` per
 * article in `content/config.yaml`. We replicate its URL construction exactly,
 * fetch each once (requires network — run intentionally, not in CI), and record
 * `url → { ok, status, json }` into `wikipedia.json`. The golden tests then mock
 * `globalThis.fetch` to replay these recordings; an unrecorded URL throws, which
 * keeps the tests hermetic and surfaces drift.
 *
 * Run: `node tests/golden/fixtures/record-wikipedia.mjs`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, '../../../content/config.yaml');
const outPath = join(here, 'wikipedia.json');

// Mirror WikipediaProvider's URL construction byte-for-byte.
function summaryUrl(title) {
  const encoded = encodeURIComponent(title.replace(/\s+/g, '_'));
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
}

const config = parse(readFileSync(configPath, 'utf8'));
const titles = [];
for (const provider of config.providers ?? []) {
  if (provider.type !== 'wikipedia') continue;
  for (const article of provider.options?.articles ?? []) titles.push(article.title);
}

const recordings = {};
for (const title of titles) {
  const url = summaryUrl(title);
  const resp = await fetch(url);
  const json = resp.ok ? await resp.json() : null;
  recordings[url] = { ok: resp.ok, status: resp.status, json };
  console.log(`recorded ${resp.status} ${title}`);
}

writeFileSync(outPath, JSON.stringify(recordings, null, 2) + '\n');
console.log(`wrote ${outPath}: ${Object.keys(recordings).length} summaries`);
