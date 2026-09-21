import {
  createFoundationState,
  getActionInputSchema,
  getStateKey,
  normalizeInput,
  resolveActionRequest,
} from './contracts.mjs';

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
        inputSchema: getActionInputSchema('set_state'),
      },
      {
        name: 'append_item',
        description: 'Append a generic task or element to the current canvas state.',
        inputSchema: getActionInputSchema('append_item'),
      },
      {
        name: 'set_theme',
        description: 'Update the active theme for the current canvas artifact.',
        inputSchema: getActionInputSchema('set_theme'),
      },
      {
        name: 'append_link',
        description: 'Append a generic external or internal link to the current canvas state.',
        inputSchema: getActionInputSchema('append_link'),
      },
    ],
    open: async (request = {}) => {
      const input = normalizeInput(request.input ?? {});
      const artifactId = getStateKey(request.artifactId ?? request.documentId ?? request.id ?? input.artifactId ?? 'kbx-canvas-artifact');
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
      const artifactId = getStateKey(payload.artifactId ?? request.artifactId ?? request.documentId ?? 'kbx-canvas-artifact');
      const result = resolveActionRequest({
        stateStore,
        artifactId,
        action: actionName,
        payload,
        defaultTitle: 'KBX Canvas',
      });

      if (!result.ok) {
        return {
          ok: false,
          error: result.errors.join('; '),
        };
      }

      if (typeof bridge?.publishState === 'function') {
        bridge.publishState(artifactId, result.state);
      }
      return {
        ok: true,
        state: result.state,
      };
    },
    close: async (request = {}) => {
      const artifactId = getStateKey(request.artifactId ?? request.documentId ?? 'kbx-canvas-artifact');
      return { ok: true, detached: true, artifactId };
    },
  };

  return provider;
}
