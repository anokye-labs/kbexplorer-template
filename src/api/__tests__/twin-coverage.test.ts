import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('twin API surface coverage', () => {
  it('twin server has routes for all ghFetch endpoints', () => {
    const githubTs = readFileSync(resolve(__dirname, '../github.ts'), 'utf8');
    const serverJs = readFileSync(resolve(__dirname, '../../../twins/github/server.js'), 'utf8');

    // Extract all ghFetch URL patterns from github.ts
    const fetchPatterns: string[] = [];
    const re = /ghFetch[^(]*\(\s*`([^`]+)`/g;
    let match;
    while ((match = re.exec(githubTs)) !== null) {
      // Normalize: replace template literals with placeholders, strip query params
      const pattern = match[1]
        .replace(/\$\{[^}]+\}/g, '__PARAM__')
        .replace(/\?.*$/, '');
      fetchPatterns.push(pattern);
    }

    const uniquePatterns = [...new Set(fetchPatterns)];
    expect(uniquePatterns.length).toBeGreaterThan(0);

    // Extract route regexes from server.js (greedy to grab full pattern body)
    const routeRegexes: RegExp[] = [];
    const routeRe = /pattern:\s*\/(.+)\//g;
    while ((match = routeRe.exec(serverJs)) !== null) {
      try {
        routeRegexes.push(new RegExp(match[1]));
      } catch { /* skip invalid regex */ }
    }

    expect(routeRegexes.length).toBeGreaterThan(0);

    for (const pattern of uniquePatterns) {
      const testPath = pattern.replace(/__PARAM__/g, 'test-value');
      const hasRoute = routeRegexes.some(rx => rx.test(testPath));
      expect(hasRoute, `No twin route matches: ${pattern}`).toBe(true);
    }
  });
});
