import { createCanvas, joinSession } from '@github/copilot-sdk/canvas';
import { createBridge } from './src/http-server.mjs';
import { createCanvasProvider } from './src/provider.mjs';

const extension = {
  id: 'kbx-canvas-foundation',
  name: 'KBX Canvas Foundation',
  description: 'Reusable KBX canvas foundation for future DAG and issue-graph variants.',
  install: async () => {
    const bridge = await createBridge({
      stateStore: new Map(),
      providerId: 'kbx-canvas-foundation',
    });

    return {
      canvas: createCanvasProvider({
        id: 'kbx-canvas-foundation',
        bridge,
        stateStore: bridge.stateStore,
      }),
      shutdown: async () => {
        await bridge.close();
      },
    };
  },
};

export default extension;

if (import.meta.url === `file://${process.argv[1]}`) {
  const session = await joinSession({
    extension: extension,
    canvases: [],
  });

  await session.ready();
}
