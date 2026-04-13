import { test, expect } from '@playwright/test';

const TWIN = 'http://localhost:3456';
const REPO = 'anokye-labs/kbexplorer-template';

test.describe('GitHub API Twin', () => {
  test('health endpoint responds', async ({ request }) => {
    const res = await request.get(`${TWIN}/health`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  test('tree endpoint returns valid entries', async ({ request }) => {
    const res = await request.get(
      `${TWIN}/repos/${REPO}/git/trees/main?recursive=1`,
    );
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.sha).toBeDefined();
    expect(data.tree.length).toBeGreaterThan(0);
    for (const entry of data.tree) {
      expect(entry).toHaveProperty('path');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('sha');
    }
  });

  test('issues endpoint returns numbered items', async ({ request }) => {
    const res = await request.get(`${TWIN}/repos/${REPO}/issues?per_page=100`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
    for (const issue of data) {
      expect(issue).toHaveProperty('number');
      expect(issue).toHaveProperty('title');
    }
  });

  test('pulls endpoint returns PR objects', async ({ request }) => {
    const res = await request.get(`${TWIN}/repos/${REPO}/pulls?per_page=100`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    for (const pr of data) {
      expect(pr).toHaveProperty('number');
      expect(pr).toHaveProperty('title');
      expect(pr).toHaveProperty('head');
    }
  });

  test('commits endpoint returns commit objects', async ({ request }) => {
    const res = await request.get(`${TWIN}/repos/${REPO}/commits?per_page=100`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
    for (const c of data) {
      expect(c).toHaveProperty('sha');
      expect(c).toHaveProperty('commit');
      expect(c.commit).toHaveProperty('message');
    }
  });

  test('pagination page 2 returns empty array', async ({ request }) => {
    const res = await request.get(
      `${TWIN}/repos/${REPO}/issues?per_page=100&page=2`,
    );
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toEqual([]);
  });

  test('unknown route returns 404', async ({ request }) => {
    const res = await request.get(`${TWIN}/repos/${REPO}/unknown`);
    expect(res.status()).toBe(404);
  });
});
