import { test, expect, type Page } from '@playwright/test';

/**
 * Agent action surface — `/events` SSE consumer (#409, epic #407).
 *
 * There's no CLI loopback server available to THIS repo's e2e run (that server
 * only exists inside `kbexplorer-cli`), so these tests prove the wiring by
 * mocking `GET /events` with `page.route`: a canned `text/event-stream` body
 * containing a real frozen-contract event (`anchor` / `graph-updated`). This is
 * a genuine end-to-end proof of the CONSUMER side — the browser's real
 * `EventSource` parses the mocked response exactly as it would parse the real
 * loopback server's stream; only the transport's origin is faked.
 */

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function bootCopilotCanvas(page: Page, anchorNodeId = 'readme'): Promise<void> {
  await page.addInitScript(anchor => {
    (window as unknown as { __KBX_CANVAS__: unknown }).__KBX_CANVAS__ = {
      local: false,
      visualMode: 'inherit-host',
      target: 'copilot',
      anchorNodeId: anchor,
    };
  }, anchorNodeId);
  await page.goto('/canvas.html', { timeout: 60000 });
}

test.describe('Agent action surface — /events consumer (#409)', () => {
  test('a dispatched anchor SSE event actually re-anchors the panel', async ({ page }) => {
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });

    // Discover a real neighbor node id from the rendered graph (no guessing —
    // same technique as the existing kg:// chip test in canvas-embed.spec.ts).
    const chip = page.locator('[data-testid="anchor-neighbor-chip"]').first();
    await expect(chip).toBeVisible();
    const targetNodeId = await chip.getAttribute('data-node-id');
    expect(targetNodeId).toBeTruthy();

    // Mock /events to emit a real `anchor` event for that node AFTER the app
    // subscribes — reload with the mock in place.
    await page.route('**/events', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseFrame('anchor', { nodeId: targetNodeId }),
      }),
    );
    await page.reload();
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });

    // The panel re-anchored on the SSE-supplied node — a real navigation, not
    // just a parsed-and-discarded event.
    await expect
      .poll(() => page.evaluate(() => location.hash), { timeout: 10000 })
      .toBe(`#/node/${encodeURIComponent(targetNodeId as string)}`);
    await expect(page.locator('[data-testid="anchor-first-view"]')).toHaveAttribute(
      'data-anchor-id',
      targetNodeId as string,
    );
  });

  test('a dispatched graph-updated SSE event actually patches the rendered view', async ({
    page,
  }) => {
    const NEW_TITLE = 'Patched via graph-updated SSE (#409)';
    await page.route('**/events', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseFrame('graph-updated', { nodes: [{ id: 'readme', title: NEW_TITLE }] }),
      }),
    );
    await bootCopilotCanvas(page, 'readme');

    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });
    await expect(anchorView).toHaveAttribute('data-anchor-id', 'readme');

    // The anchor node's title was patched in place by the mocked SSE event —
    // proof the view actually re-rendered from the mutated live graph, not
    // just from the originally-loaded static manifest.
    await expect(page.getByText(NEW_TITLE)).toBeVisible({ timeout: 10000 });
  });

  test('degrades safely with no /events endpoint at all (this repo\'s own preview server)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('@griffel')) errors.push(msg.text());
    });
    // No page.route mock — /events genuinely 404s against `vite preview`,
    // exactly like this repo's own dev/preview server.
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    const appErrors = errors.filter(
      e => !e.includes('403') && !e.includes('rate limit') && !e.includes('Failed to load resource'),
    );
    expect(appErrors).toHaveLength(0);
  });
});

/**
 * Reason-aware `graph-updated` (#409, cli#214): `expand` / `trace` / `filter`
 * arrive over the SAME `graph-updated` event as the content-patch tests above,
 * distinguished by a `reason` field. Each test discovers a REAL neighbor node
 * id from the rendered graph first (no invented ids), then mocks `/events` to
 * emit that exact frozen-contract payload shape and asserts the resulting DOM
 * change — proof the reason-aware branch actually re-renders, not just parses.
 */
test.describe('Agent action surface — reason-aware graph-updated (#409, cli#214)', () => {
  test('expand force-promotes a real chip neighbor into an expanded card, focused', async ({
    page,
  }) => {
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });

    const chip = page.locator('[data-testid="anchor-neighbor-chip"]').first();
    await expect(chip).toBeVisible();
    const targetNodeId = await chip.getAttribute('data-node-id');
    expect(targetNodeId).toBeTruthy();

    await page.route('**/events', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseFrame('graph-updated', {
          reason: 'expand',
          nodes: [targetNodeId],
          focus: targetNodeId,
        }),
      }),
    );
    await page.reload();
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });

    const expandedCard = page.locator(
      `[data-testid="anchor-expanded-neighbor"][data-node-id="${targetNodeId}"]`,
    );
    await expect(expandedCard).toBeVisible({ timeout: 10000 });
    await expect(expandedCard).toHaveAttribute('data-kbx-focused', 'true');
    // ...and it's no longer ALSO rendered as a chip.
    await expect(
      page.locator(`[data-testid="anchor-neighbor-chip"][data-node-id="${targetNodeId}"]`),
    ).toHaveCount(0);
  });

  test('trace renders a path banner and highlights the matching visible neighbor', async ({
    page,
  }) => {
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });

    const neighbor = page.locator('[data-testid="anchor-expanded-neighbor"]').first();
    await expect(neighbor).toBeVisible();
    const targetNodeId = await neighbor.getAttribute('data-node-id');
    expect(targetNodeId).toBeTruthy();

    await page.route('**/events', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseFrame('graph-updated', {
          reason: 'trace',
          nodes: ['readme', targetNodeId],
          path: ['readme', targetNodeId],
          connected: true,
        }),
      }),
    );
    await page.reload();

    const banner = page.locator('[data-testid="anchor-trace-banner"]');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toHaveAttribute('data-connected', 'true');
    await expect(
      page.locator(
        `[data-testid="anchor-expanded-neighbor"][data-node-id="${targetNodeId}"]`,
      ),
    ).toHaveAttribute('data-kbx-on-trace', 'true');
  });

  test('filter constrains the rendered neighbors to the matched set', async ({ page }) => {
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });

    const neighbor = page.locator('[data-testid="anchor-expanded-neighbor"]').first();
    await expect(neighbor).toBeVisible();
    const keepNodeId = await neighbor.getAttribute('data-node-id');
    expect(keepNodeId).toBeTruthy();

    await page.route('**/events', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseFrame('graph-updated', {
          reason: 'filter',
          filter: { query: 'kept' },
          nodes: [keepNodeId],
        }),
      }),
    );
    await page.reload();

    await expect(page.locator('[data-testid="anchor-filter-hint"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator(`[data-testid="anchor-expanded-neighbor"][data-node-id="${keepNodeId}"]`),
    ).toBeVisible();
    // Every OTHER previously-rendered neighbor card/chip is now filtered out.
    await expect(
      page.locator(
        `[data-testid="anchor-expanded-neighbor"]:not([data-node-id="${keepNodeId}"])`,
      ),
    ).toHaveCount(0);
    await expect(page.locator('[data-testid="anchor-neighbor-chip"]')).toHaveCount(0);
  });
});
