/**
 * Replays recorded Wikipedia summaries (see `fixtures/record-wikipedia.mjs`) by
 * mocking `globalThis.fetch`, so the golden builds are hermetic and
 * deterministic. Any URL without a recording rejects — that keeps the build
 * offline and turns provider/config drift into a visible golden diff (the
 * provider swallows fetch errors, dropping the node).
 */
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

interface Recording {
  ok: boolean;
  status: number;
  json: unknown;
}

const here = dirname(fileURLToPath(import.meta.url));
const recordings = JSON.parse(
  readFileSync(join(here, 'fixtures', 'wikipedia.json'), 'utf8'),
) as Record<string, Recording>;

/** Install the recorded-fetch mock. Returns the spy for assertions. */
export function installWikipediaFetchMock() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    const rec = recordings[url];
    if (!rec) {
      throw new Error(`hermetic golden: no recorded fetch for ${url}`);
    }
    return new Response(JSON.stringify(rec.json), {
      status: rec.status,
      headers: { 'content-type': 'application/json' },
    });
  });
}
