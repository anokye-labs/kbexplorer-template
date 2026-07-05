import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GITHUB_ENDPOINT_PATTERNS } from '@anokye-labs/kbexplorer-engine/sources';

/**
 * Cross-repo DTU drift-detection test (anokye-labs/kbexplorer-template#472,
 * slice 4/5 STEP B).
 *
 * Before slice 4, this test regexed `github.ts`'s own `ghFetch` call sites
 * for endpoint patterns. `github.ts` no longer contains any `ghFetch` calls
 * — the GitHub REST client moved to `@anokye-labs/kbexplorer-engine`'s
 * `./sources` subpath, which now exports `GITHUB_ENDPOINT_PATTERNS`: a
 * single source of truth, colocated with the code that actually makes the
 * calls, derived directly from its `ghFetch` call sites. Importing it here
 * (rather than hard-coding a duplicate list) keeps drift detection alive
 * across the repo boundary — if the engine adds an endpoint and updates the
 * const, this test fails (after the template re-pins) until a matching
 * twin route exists.
 */
describe('twin API surface coverage', () => {
  it('twin server has routes for every GITHUB_ENDPOINT_PATTERNS entry', () => {
    const serverJs = readFileSync(resolve(__dirname, '../../../twins/github/server.js'), 'utf8');

    expect(GITHUB_ENDPOINT_PATTERNS.length).toBeGreaterThan(0);

    // Extract route regexes from server.js (greedy to grab full pattern body)
    const routeRegexes: RegExp[] = [];
    const routeRe = /pattern:\s*\/(.+)\//g;
    let match;
    while ((match = routeRe.exec(serverJs)) !== null) {
      try {
        routeRegexes.push(new RegExp(match[1]));
      } catch { /* skip invalid regex */ }
    }

    expect(routeRegexes.length).toBeGreaterThan(0);

    for (const pattern of GITHUB_ENDPOINT_PATTERNS) {
      // Build a representative repo-scoped path. Patterns ending in `/`
      // (contents/, git/trees/) need a trailing segment to satisfy routes
      // requiring `(.+)` after the prefix; bare patterns (issues, pulls,
      // commits, releases) match their route's `(?:\?|$)` end anchor as-is.
      const testPath = `/repos/test-owner/test-repo/${pattern}${pattern.endsWith('/') ? 'test-value' : ''}`;
      const hasRoute = routeRegexes.some(rx => rx.test(testPath));
      expect(hasRoute, `No twin route matches GITHUB_ENDPOINT_PATTERNS entry: ${pattern}`).toBe(true);
    }
  });
});
