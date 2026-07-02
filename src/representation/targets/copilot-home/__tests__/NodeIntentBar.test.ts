import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NodeIntentBar } from '../NodeIntentBar';

/**
 * NodeIntentBar (#410) — structural/DOM-contract assertions only. Static
 * markup can't exercise clicks/state transitions (no jsdom in this repo's
 * vitest setup, consistent with CanvasShell.test.ts); the interactive
 * pending → ok/unavailable behavior and the "no direct /affordance POST" and
 * "hint on unavailable" acceptance criteria are covered by
 * e2e/node-intent-bar.spec.ts in a real browser.
 */
describe('NodeIntentBar (#410)', () => {
  it('renders exactly the three default intents from the #410 issue body', () => {
    const html = renderToStaticMarkup(
      createElement(NodeIntentBar, { nodeId: 'readme', chatIntentUrl: '/chat-intent' }),
    );
    expect(html).toContain('data-testid="node-intent-bar"');
    expect(html).toContain('data-node-id="readme"');
    expect(html).toContain('data-testid="node-intent-pin"');
    expect(html).toContain('data-testid="node-intent-derives"');
    expect(html).toContain('data-testid="node-intent-affected"');
    expect(html).toContain('Pin as anchor');
    expect(html).toContain('What derives from this?');
    expect(html).toContain('Show affected');
  });

  it('renders nothing for an empty action list (an empty bar is a no-op)', () => {
    const html = renderToStaticMarkup(
      createElement(NodeIntentBar, { nodeId: 'readme', chatIntentUrl: '/chat-intent', actions: [] }),
    );
    expect(html).toBe('');
  });

  it('honors an extensible custom action list, not a hardcoded set of three', () => {
    const html = renderToStaticMarkup(
      createElement(NodeIntentBar, {
        nodeId: 'readme',
        chatIntentUrl: '/chat-intent',
        actions: [{ id: 'custom', label: 'Custom action' }],
      }),
    );
    expect(html).toContain('data-testid="node-intent-custom"');
    expect(html).toContain('Custom action');
    expect(html).not.toContain('Pin as anchor');
  });

  it('does not render the unavailable hint before any click has happened', () => {
    const html = renderToStaticMarkup(
      createElement(NodeIntentBar, { nodeId: 'readme', chatIntentUrl: '/chat-intent' }),
    );
    expect(html).not.toContain('node-intent-unavailable-hint');
  });
});
