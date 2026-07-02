import { test, expect, type Page } from '@playwright/test';

/**
 * Bidirectional click → chat: the `/chat-intent` consumer (#410, epic #407).
 *
 * There's no CLI loopback server available to THIS repo's e2e run (that
 * server + the agent chat turn it triggers only exist inside `kbexplorer-cli`,
 * and `kbexplorer-cli#195` — the seam that turns a posted intent into a real
 * chat turn — is still open as of this PR). These tests prove the TEMPLATE
 * side of the contract the same way canvas-events.spec.ts proved #409's
 * consumer side: mock `POST /chat-intent` with `page.route` and assert the
 * real click → real `fetch` → real DOM state transition, then (reusing #409's
 * already-proven `/events` mechanism) show that an agent's follow-up `anchor`
 * event completes the round trip the click kicked off. What's simulated here
 * is the AGENT'S reply (no live agent exists in this test env); what's real
 * is every hop the template code owns: the click handler, the intent POST
 * body, the pending → acknowledged UI, and the SSE-driven re-anchor.
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

test.describe('Bidirectional click → chat — /chat-intent consumer (#410)', () => {
  test('clicking "What derives from this?" POSTs the exact intent and shows pending → acknowledged', async ({
    page,
  }) => {
    const requests: unknown[] = [];
    await page.route('**/chat-intent', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await bootCopilotCanvas(page, 'readme');
    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });

    const derivesButton = anchorView.locator('[data-testid="node-intent-derives"]').first();
    await expect(derivesButton).toBeVisible();
    await expect(derivesButton).toHaveAttribute('data-intent-state', 'idle');

    await derivesButton.click();
    await expect(derivesButton).toHaveAttribute('data-intent-state', 'ok', { timeout: 10000 });

    expect(requests).toEqual([
      { intent: 'derives', nodeId: 'readme', prompt: 'What derives from this node?' },
    ]);
  });

  test('"Pin as anchor" on a neighbor posts the intent, then the agent\'s anchor event re-anchors the panel', async ({
    page,
  }) => {
    await bootCopilotCanvas(page, 'readme');
    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });

    // A real expanded neighbor's own "Pin as anchor" button — discovered from
    // the rendered graph, not hardcoded (same technique as #409's tests).
    const neighborCard = page.locator('[data-testid="anchor-expanded-neighbor"]').first();
    await expect(neighborCard).toBeVisible();
    const targetNodeId = await neighborCard.getAttribute('data-node-id');
    expect(targetNodeId).toBeTruthy();

    const requests: unknown[] = [];
    await page.route('**/chat-intent', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    // The agent's reply is simulated (no live agent in this test env): once
    // the click has posted the intent, an `anchor` SSE event for the SAME
    // node — #409's already-proven consumer — completes the round trip.
    await page.route('**/events', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseFrame('anchor', { nodeId: targetNodeId }),
      }),
    );

    const pinButton = neighborCard.locator('[data-testid="node-intent-pin"]');
    await expect(pinButton).toBeVisible();
    await pinButton.click();
    await expect(pinButton).toHaveAttribute('data-intent-state', 'ok', { timeout: 10000 });

    expect(requests).toEqual([{ intent: 'pin', nodeId: targetNodeId }]);

    // Reload so the mocked /events stream (registered above) is consumed on
    // connect — mirrors canvas-events.spec.ts's anchor round-trip test.
    await page.reload();
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });
    await expect
      .poll(() => page.evaluate(() => location.hash), { timeout: 10000 })
      .toBe(`#/node/${encodeURIComponent(targetNodeId as string)}`);
    await expect(page.locator('[data-testid="anchor-first-view"]')).toHaveAttribute(
      'data-anchor-id',
      targetNodeId as string,
    );
  });

  test('degrades gracefully with a visible hint when /chat-intent is absent (older CLI)', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('@griffel')) errors.push(msg.text());
    });
    await page.route('**/chat-intent', route => route.fulfill({ status: 404, body: 'not found' }));

    await bootCopilotCanvas(page, 'readme');
    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });

    const affectedButton = anchorView.locator('[data-testid="node-intent-affected"]').first();
    await affectedButton.click();
    await expect(affectedButton).toHaveAttribute('data-intent-state', 'unavailable', {
      timeout: 10000,
    });
    await expect(
      anchorView.locator('[data-testid="node-intent-unavailable-hint"]').first(),
    ).toBeVisible();

    const appErrors = errors.filter(
      e => !e.includes('403') && !e.includes('rate limit') && !e.includes('Failed to load resource'),
    );
    expect(appErrors).toHaveLength(0);
  });

  test('no node-intent click ever issues a direct mutating /affordance/:name request', async ({
    page,
  }) => {
    let affordanceHits = 0;
    await page.route('**/affordance/**', route => {
      affordanceHits += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/chat-intent', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    await bootCopilotCanvas(page, 'readme');
    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });

    // Click every default intent action on the anchor — none of them, read-
    // only-sounding ("What derives from this?") or explicitly mutating
    // ("Pin as anchor"), may ever hit /affordance/:name directly.
    for (const id of ['pin', 'derives', 'affected']) {
      const button = anchorView.locator(`[data-testid="node-intent-${id}"]`).first();
      await button.click();
      await expect(button).toHaveAttribute('data-intent-state', 'ok', { timeout: 10000 });
    }

    expect(affordanceHits).toBe(0);
  });

  test('per-node intent state resets when the panel re-anchors (no stale badge carries across navigation)', async ({
    page,
  }) => {
    await page.route('**/chat-intent', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    await bootCopilotCanvas(page, 'readme');
    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });
    await expect(anchorView).toHaveAttribute('data-anchor-id', 'readme');

    // A real neighbor to re-anchor onto — discovered from the rendered graph,
    // not hardcoded (same technique as the round-trip test above).
    const neighborCard = page.locator('[data-testid="anchor-expanded-neighbor"]').first();
    await expect(neighborCard).toBeVisible();
    const neighborId = await neighborCard.getAttribute('data-node-id');
    expect(neighborId).toBeTruthy();
    expect(neighborId).not.toBe('readme');

    // Drive the ANCHOR node's "derives" intent to a terminal (`ok`) state.
    const anchorDerives = anchorView.locator('[data-testid="node-intent-derives"]').first();
    await expect(anchorDerives).toHaveAttribute('data-intent-state', 'idle');
    await anchorDerives.click();
    await expect(anchorDerives).toHaveAttribute('data-intent-state', 'ok', { timeout: 10000 });

    // Re-anchor onto the neighbor through the hash router. This re-renders the
    // SAME AnchorFirstView — and its single anchor-level NodeIntentBar instance
    // — with a new `nodeId`; it is NOT remounted. That reuse is exactly the path
    // that used to leak the previous node's `ok` badge onto the new node's bar.
    await page.evaluate(id => {
      location.hash = `#/node/${encodeURIComponent(id)}`;
    }, neighborId as string);
    await expect(anchorView).toHaveAttribute('data-anchor-id', neighborId as string, {
      timeout: 10000,
    });

    // The freshly-anchored node's bar must be back to `idle`, never the previous
    // node's `ok`.
    const newAnchorDerives = anchorView.locator('[data-testid="node-intent-derives"]').first();
    await expect(newAnchorDerives).toHaveAttribute('data-intent-state', 'idle');
  });
});
