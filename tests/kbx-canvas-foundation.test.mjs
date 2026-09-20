import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAction, createFoundationState, normalizeInput, validateAgainstSchema } from '../.github/extensions/kbx-canvas-foundation/src/contracts.mjs';
import { createBridge } from '../.github/extensions/kbx-canvas-foundation/src/http-server.mjs';
import { createCanvasProvider } from '../.github/extensions/kbx-canvas-foundation/src/provider.mjs';

const actionSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['set_state', 'append_item', 'set_theme'] },
    payload: { type: 'object' },
  },
  required: ['action'],
};

test('foundation state normalizes an artifact ID and default theme', () => {
  const state = createFoundationState({
    artifactId: 'Issue DAG#1',
    title: 'Issue DAG preview',
    theme: 'WARM',
  });

  assert.equal(state.artifactId, 'Issue-DAG#1');
  assert.equal(state.theme, 'dark');
  assert.equal(state.version, 1);
});

test('action validation rejects malformed payloads', () => {
  const result = validateAgainstSchema(actionSchema, { action: 'set_theme', payload: { theme: 'neon' } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => String(error).includes('theme')));
});

test('state actions append new items without mutating the prior state object', () => {
  const initial = createFoundationState({ artifactId: 'artifact-1', title: 'Initial canvas', items: [{ id: 'x', title: 'x', status: 'active' }] });
  const updated = applyAction(initial, 'append_item', { title: 'y', status: 'done' });

  assert.equal(initial.items.length, 1);
  assert.equal(updated.items.length, 2);
  assert.equal(updated.items[1].title, 'y');
});

test('provider keeps durable artifact state stable across instanceId changes', async () => {
  const stateStore = new Map();
  const provider = createCanvasProvider({ bridge: { port: 3000 }, stateStore });

  await provider.open({
    instanceId: 'panel-a',
    input: { artifactId: 'artifact-1', title: 'Persistent canvas', theme: 'light' },
  });

  const reopened = await provider.open({
    instanceId: 'panel-b',
    input: { artifactId: 'artifact-1', title: 'Unrelated title', theme: 'dark' },
  });

  assert.equal(reopened.title, 'Persistent canvas');
  assert.equal(stateStore.get('artifact-1').title, 'Persistent canvas');
});

test('bridge serves canvas HTML and processes POST state updates', async () => {
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
  assert.equal(pageResponse.status, 200);
  assert.match(pageText, /Demo canvas/);

  const updateResponse = await fetch(`http://127.0.0.1:${bridge.port}/api/canvas/demo-canvas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'append_item',
      payload: { title: 'Recorded task', status: 'done', description: 'Added through the generic API' },
    }),
  });

  assert.equal(updateResponse.status, 200);
  const state = await updateResponse.json();
  assert.equal(state.items.length, 2);
  await bridge.close();
});
