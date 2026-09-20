import { createActionSchema, createFoundationState, getStateKey, normalizeInput, applyAction, validateAgainstSchema } from './contracts.mjs';

export function createCanvasProvider({
  id = 'kbx-canvas-foundation',
  bridge,
  stateStore,
}) {
  const provider = {
    id,
    displayName: 'KBX Canvas Foundation',
    description: 'Reusable canvas shell for KBX graphs and future DAG variants.',
    actions: [
      {
        name: 'set_state',
        description: 'Replace the durable state for a canvas artifact.',
        inputSchema: {
          type: 'object',
          properties: {
            artifactId: { type: 'string' },
            title: { type: 'string' },
            theme: { type: 'string', enum: ['dark', 'light', 'sepia', 'ocean'] },
            status: { type: 'string', enum: ['loading', 'ready', 'empty', 'error'] },
            items: { type: 'array' },
            links: { type: 'array' },
          },
          additionalProperties: true,
        },
      },
      {
        name: 'append_item',
        description: 'Append a generic task or element to the current canvas state.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['blocked', 'active', 'done'] },
            url: { type: 'string' },
          },
          required: ['title'],
          additionalProperties: true,
        },
      },
      {
        name: 'set_theme',
        description: 'Update the active theme for the current canvas artifact.',
        inputSchema: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['dark', 'light', 'sepia', 'ocean'] },
          },
          required: ['theme'],
        },
      },
    ],
    open: async (request = {}) => {
      const input = normalizeInput(request.input ?? {});
      const artifactId = getStateKey(input.artifactId || request.artifactId || request.documentId || request.id || 'kbx-canvas-artifact');
      const current = stateStore.get(artifactId);

      if (current) {
        return {
          url: `http://127.0.0.1:${bridge.port}/canvas/${encodeURIComponent(artifactId)}?artifactId=${encodeURIComponent(artifactId)}&instanceId=${encodeURIComponent(request.instanceId || 'default')}`,
          title: current.title,
          status: current.status,
        };
      }

      const durable = createFoundationState({ ...input, artifactId });
      stateStore.set(artifactId, durable);

      return {
        url: `http://127.0.0.1:${bridge.port}/canvas/${encodeURIComponent(artifactId)}?artifactId=${encodeURIComponent(artifactId)}&instanceId=${encodeURIComponent(request.instanceId || 'default')}`,
        title: durable.title,
        status: durable.status,
      };
    },
    invoke: async (request = {}) => {
      const actionName = request.action || request.name;
      const payload = request.payload ?? {};
      const artifactId = getStateKey(payload.artifactId ?? request.artifactId ?? 'kbx-canvas-artifact');
      const state = stateStore.get(artifactId) ?? createFoundationState({ artifactId, title: 'KBX Canvas' });
      const schema = createActionSchema();
      const validation = validateAgainstSchema(schema, { action: actionName, payload });

      if (!validation.valid) {
        return {
          ok: false,
          error: validation.errors.join('; '),
        };
      }

      const nextState = applyAction(state, actionName, payload);
      stateStore.set(artifactId, nextState);
      return {
        ok: true,
        state: nextState,
      };
    },
    close: async (request = {}) => {
      const artifactId = getStateKey(request.artifactId ?? request.documentId ?? 'kbx-canvas-artifact');
      stateStore.delete(artifactId);
      return { ok: true };
    },
  };

  return provider;
}
