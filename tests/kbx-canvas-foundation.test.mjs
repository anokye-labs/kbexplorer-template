import { describe, expect, it, vi } from 'vitest';

import {
  applyAction,
  createFoundationState,
  getActionInputSchema,
  resolveActionRequest,
  validateAgainstSchema,
} from '../.github/extensions/kbx-canvas-foundation/src/contracts.mjs';
import { createBridge } from '../.github/extensions/kbx-canvas-foundation/src/http-server.mjs';
import { createCanvasProvider } from '../.github/extensions/kbx-canvas-foundation/src/provider.mjs';
import { renderCanvasDocument } from '../.github/extensions/kbx-canvas-foundation/src/renderer.mjs';

describe('kbx canvas foundation', () => {
  it('normalizes an artifact ID and default theme', () => {
    const state = createFoundationState({
      artifactId: 'Issue DAG#1',
      title: 'Issue DAG preview',
      theme: 'WARM',
    });

    expect(state.artifactId).toBe('Issue-DAG#1');
    expect(state.theme).toBe('dark');
    expect(state.version).toBe(1);
  });

  it('enforces required schema properties before validating present keys', () => {
    const result = validateAgainstSchema({ type: 'object', required: ['action'] }, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => String(error).includes("Missing required property 'action'"))).toBe(true);
  });

  it('rejects malformed payloads for action schemas', () => {
    const result = validateAgainstSchema(getActionInputSchema('set_theme'), { theme: 'neon' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => String(error).includes('theme'))).toBe(true);
  });

  it('appends items without mutating the prior state object', () => {
    const initial = createFoundationState({
      artifactId: 'artifact-1',
      title: 'Initial canvas',
      items: [{ id: 'x', title: 'x', status: 'active' }],
    });

    const updated = applyAction(initial, 'append_item', { title: 'y', status: 'done' });

    expect(initial.items).toHaveLength(1);
    expect(updated.items).toHaveLength(2);
    expect(updated.items[1].title).toBe('y');
  });

  it('prefers request artifact IDs before falling back to the default durable state', async () => {
    const stateStore = new Map();
    const provider = createCanvasProvider({
      bridge: { port: 3000, publishState: () => {} },
      stateStore,
    });

    await provider.open({
      instanceId: 'panel-a',
      input: { artifactId: 'artifact-1', title: 'Persistent canvas', theme: 'light' },
    });

    const reopened = await provider.open({
      instanceId: 'panel-b',
      input: { artifactId: 'artifact-1', title: 'Unrelated title', theme: 'dark' },
    });

    expect(reopened.title).toBe('Persistent canvas');
    expect(stateStore.get('artifact-1').title).toBe('Persistent canvas');

    const custom = await provider.open({
      instanceId: 'panel-c',
      artifactId: 'custom-artifact',
      input: { artifactId: 'artifact-2', title: 'Custom instance' },
    });

    expect(custom.url).toContain(encodeURIComponent('custom-artifact'));
  });

  it('keeps durable artifact state stable across instanceId changes and close is detach-only', async () => {
    const stateStore = new Map();
    const provider = createCanvasProvider({
      bridge: { port: 3000, publishState: () => {} },
      stateStore,
    });

    await provider.open({
      instanceId: 'panel-a',
      input: { artifactId: 'artifact-1', title: 'Persistent canvas', theme: 'light' },
    });

    const detached = await provider.close({ artifactId: 'artifact-1' });
    expect(detached.ok).toBe(true);
    expect(detached.detached).toBe(true);
    expect(stateStore.has('artifact-1')).toBe(true);
  });

  it('supports append_link and validates the matching action schema before mutation', () => {
    const state = createFoundationState({ artifactId: 'artifact-x', title: 'Link canvas' });
    const updated = applyAction(state, 'append_link', { label: 'Docs', href: 'https://example.com/docs' });

    expect(updated.links).toHaveLength(1);
    expect(updated.links[0].href).toBe('https://example.com/docs');
    expect(validateAgainstSchema(getActionInputSchema('append_link'), { label: 'Docs' }).valid).toBe(false);
  });

  it('serves canvas HTML and rejects malformed POST state updates through the validated boundary', async () => {
    const stateStore = new Map();
    const bridge = await createBridge({ stateStore, providerId: 'kbx-canvas-foundation' });

    stateStore.set('demo-canvas', createFoundationState({
      artifactId: 'demo-canvas',
      title: 'Demo canvas',
      items: [{ id: 'i-1', title: 'Example item', status: 'active' }],
      links: [{ id: 'l-1', label: 'Example link', href: 'https://example.com' }],
    }));

    const pageResponse = await fetch(`http://127.0.0.1:${bridge.port}/canvas/demo-canvas?artifactId=demo-canvas`);
    const pageText = await pageResponse.text();
    expect(pageResponse.status).toBe(200);
    expect(pageText).toContain('Demo canvas');

    const invalidUpdateResponse = await fetch(`http://127.0.0.1:${bridge.port}/api/canvas/demo-canvas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'append_item', payload: { status: 'done' } }),
    });
    expect(invalidUpdateResponse.status).toBe(400);

    const validUpdateResponse = await fetch(`http://127.0.0.1:${bridge.port}/api/canvas/demo-canvas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'append_item',
        payload: { title: 'Recorded task', status: 'done', description: 'Added through the generic API' },
      }),
    });

    expect(validUpdateResponse.status).toBe(200);
    const state = await validUpdateResponse.json();
    expect(state.items).toHaveLength(2);
    await bridge.close();
  });

  it('escapes untrusted strings and prevents unsafe href interpolation in the renderer', () => {
    const html = renderCanvasDocument({
      artifactId: 'hijack',
      title: '<script>alert(1)</script>',
      theme: 'dark',
      status: 'ready',
      items: [{ title: '<img src=x onerror=alert(1)>', description: '<b>unsafe</b>', status: 'active' }],
      links: [{ label: '<svg/onload=alert(1)>', href: 'javascript:alert(1)' }],
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).toContain('data-invalid');
  });

  it('publishes bridge state changes after direct provider mutations and resolves validated actions', async () => {
    const stateStore = new Map();
    const bridge = {
      port: 3000,
      publishState: vi.fn(),
    };

    const provider = createCanvasProvider({ bridge, stateStore });
    const openResult = await provider.open({
      instanceId: 'panel-1',
      input: { artifactId: 'artifact-demo', title: 'Live canvas', theme: 'light' },
    });

    expect(openResult.status).toBe('ready');

    const result = await provider.invoke({
      action: 'append_item',
      payload: { artifactId: 'artifact-demo', title: 'Live task', status: 'done' },
    });

    expect(result.ok).toBe(true);
    expect(result.state.items[0].title).toBe('Live task');
    expect(bridge.publishState).toHaveBeenCalledTimes(1);

    const invalid = await provider.invoke({
      action: 'set_theme',
      payload: { artifactId: 'artifact-demo', theme: 'neon' },
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.error).toContain('theme');
    expect(resolveActionRequest({
      stateStore,
      artifactId: 'artifact-demo',
      action: 'append_link',
      payload: { href: 'https://example.com/next', label: 'Next' },
      defaultTitle: 'KBX Canvas',
    }).ok).toBe(true);
  });
});
