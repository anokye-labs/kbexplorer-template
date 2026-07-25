/**
 * Composes GitHub REST API fixture-routing with the recorded-Wikipedia fetch
 * mock (see `wikipedia-mock.ts`) into a SINGLE `globalThis.fetch` spy —
 * `vi.spyOn` only supports one active implementation per mocked function, so
 * the two mocks can't be installed independently.
 *
 * anokye-labs/kbexplorer-template#472 (slice 4/5 STEP B): `GitHubApiSource`'s
 * real fetch implementation now lives entirely inside
 * `@anokye-labs/kbexplorer-engine` and calls `globalThis.fetch` directly
 * (rather than functions re-exported from template's `src/api`), so mocking
 * `src/api`'s exports no longer intercepts anything it does. This routes
 * GitHub REST endpoint URLs to the same `remote-api.json` fixture the old
 * per-function mocks served, replicating exactly the response shape the
 * engine's `ghFetch` expects (status/ok/headers.get/json/text) — so the REAL
 * ported fetch → decode → parse → graph pipeline runs end-to-end with only
 * the network boundary stubbed. Any URL that matches neither a GitHub
 * endpoint for the fixture's repo nor a recorded Wikipedia summary still
 * throws, so the golden stays hermetic.
 */
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

interface WikipediaRecording {
  ok: boolean;
  status: number;
  json: unknown;
}

export interface RemoteApiFixture {
  source: { owner: string; repo: string; path?: string; branch?: string };
  issues: unknown[];
  pullRequests: unknown[];
  commits: unknown[];
  releases: unknown[];
  tree: Array<{ path: string; type: string; size?: number }>;
  files: Record<string, string>;
}

const here = dirname(fileURLToPath(import.meta.url));
const wikipediaRecordings = JSON.parse(
  readFileSync(join(here, 'fixtures', 'wikipedia.json'), 'utf8'),
) as Record<string, WikipediaRecording>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Base64-encode UTF-8 text the way the engine's `fetchFile` (`atob` + `TextDecoder`) expects to decode it. */
function toBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

/**
 * Install a fetch mock that routes:
 *  - GitHub REST API URLs for the fixture's repo
 *    (`https://api.github.com/repos/{owner}/{repo}/...`) to `fixture`.
 *  - Recorded Wikipedia summary URLs to `fixtures/wikipedia.json`.
 *  - Anything else throws, so unrecorded network activity fails loudly.
 *
 * Returns the spy for call assertions (e.g. hermeticity checks).
 */
export function installRemoteApiFetchMock(fixture: RemoteApiFixture) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('https://en.wikipedia.org/')) {
      const rec = wikipediaRecordings[url];
      if (!rec) throw new Error(`hermetic golden: no recorded fetch for ${url}`);
      return jsonResponse(rec.json, rec.status);
    }

    const parsedUrl = new URL(url);
    const ghBasePath = `/repos/${fixture.source.owner}/${fixture.source.repo}`;
    if (parsedUrl.hostname === 'api.github.com' && parsedUrl.pathname.startsWith(ghBasePath)) {
      const rest = `${parsedUrl.pathname.slice(ghBasePath.length).replace(/^\//, '')}${parsedUrl.search}`;

      if (rest === '' || rest === '?') {
        return jsonResponse({
          name: fixture.source.repo,
          full_name: `${fixture.source.owner}/${fixture.source.repo}`,
          default_branch: fixture.source.branch ?? 'main',
          html_url: `https://github.com/${fixture.source.owner}/${fixture.source.repo}`,
        });
      }

      if (rest.startsWith('contents/')) {
        const rawPath = rest.slice('contents/'.length).split('?')[0];
        const path = decodeURIComponent(rawPath);
        const content = fixture.files[path];
        if (content === undefined) return jsonResponse({ message: 'Not Found' }, 404);
        return jsonResponse({
          name: path.split('/').pop() ?? path,
          path,
          sha: `fixture-sha-${path}`,
          content: toBase64(content),
          encoding: 'base64',
        });
      }

      if (rest === 'branches' || rest.startsWith('branches?')) {
        return jsonResponse([]);
      }

      if (rest === 'languages' || rest.startsWith('languages?')) {
        return jsonResponse({});
      }

      if (rest.startsWith('git/trees/')) {
        return jsonResponse({ tree: fixture.tree });
      }

      if (rest.startsWith('issues?')) {
        const page = new URL(url).searchParams.get('page') ?? '1';
        return jsonResponse(page === '1' ? fixture.issues : []);
      }

      if (rest.startsWith('pulls?')) {
        const page = new URL(url).searchParams.get('page') ?? '1';
        return jsonResponse(page === '1' ? fixture.pullRequests : []);
      }

      if (rest.startsWith('commits?')) {
        return jsonResponse(fixture.commits);
      }

      if (rest.startsWith('releases?')) {
        return jsonResponse(fixture.releases);
      }
    }

    throw new Error(`hermetic golden: no recorded fetch for ${url}`);
  });
}

/**
 * In-memory `localStorage` stand-in for Node's `vitest` `environment: 'node'`
 * (no browser storage global). `loadRemoteKnowledgeBase` now injects
 * template's `localStorageCacheStore` adapter by default (STEP B), so this
 * golden test exercises real cache reads/writes even though it only cares
 * about the fetched data, not caching per se.
 */
export function installInMemoryLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    clear: () => store.clear(),
  });
  return store;
}
