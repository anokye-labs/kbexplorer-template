import { test, expect, request as pwRequest } from '@playwright/test';
import { coords } from '../../twins/gitea/gitea-client.mjs';
import { openIssue } from '../../twins/gitea/actors/open-issue.mjs';

/**
 * Request-level checks against the LIVE adapter + Gitea (not mocked): prove the
 * GitHub-shaped header synthesis and the ETag/304 refresh contract `ghFetch`
 * relies on, plus that a real mutation invalidates the cached representation.
 */

const TWIN_PORT = Number(process.env.DTU_TWIN_PORT ?? 3557);
const TWIN_BASE = `http://localhost:${TWIN_PORT}`;

test.describe('Gitea DTU — adapter refresh contract', () => {
  test('synthesizes GitHub-style headers and honors the ETag/304 → fresh-after-change cycle', async () => {
    const { owner, repo } = coords();
    const issuesPath = `/repos/${owner}/${repo}/issues?state=all&per_page=100&page=1`;
    const ctx = await pwRequest.newContext({ baseURL: TWIN_BASE });

    try {
      // 1) First read: GitHub-shaped headers present.
      const first = await ctx.get(issuesPath);
      expect(first.status()).toBe(200);
      const headers = first.headers();
      expect(headers['etag']).toBeTruthy();
      expect(headers['x-ratelimit-limit']).toBeTruthy();
      const etag = headers['etag'];
      const beforeLen = (await first.json()).length;

      // 2) Conditional re-read with the same ETag → 304 Not Modified.
      const notModified = await ctx.get(issuesPath, { headers: { 'If-None-Match': etag } });
      expect(notModified.status()).toBe(304);

      // 3) An actor mutates the repo → the cached representation must invalidate.
      await openIssue({ title: `DTU adapter refresh ${Date.now()}`, labels: ['enhancement'] });

      const afterChange = await ctx.get(issuesPath, { headers: { 'If-None-Match': etag } });
      expect(afterChange.status()).toBe(200); // body changed → no 304
      const afterLen = (await afterChange.json()).length;
      expect(afterLen).toBe(beforeLen + 1);
      expect(afterChange.headers()['etag']).not.toBe(etag);
    } finally {
      await ctx.dispose();
    }
  });
});
