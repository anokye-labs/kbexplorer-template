import http from 'node:http';
import { applyAction, createFoundationState, createDefaultStore, getStateKey, normalizeInput } from './contracts.mjs';
import { renderCanvasDocument } from './renderer.mjs';

export async function createBridge({ stateStore = createDefaultStore(), providerId = 'kbx-canvas-foundation' } = {}) {
  const subscribers = new Map();

  const sendEvent = (artifactId, eventName, payload) => {
    const listeners = subscribers.get(artifactId) || [];
    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const writer of listeners) {
      writer.write(message);
    }
  };

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = requestUrl.pathname;

    if (pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, providerId }));
      return;
    }

    const canvasMatch = pathname.match(/^\/canvas\/([^/]+)$/);
    if (canvasMatch) {
      const artifactId = decodeURIComponent(canvasMatch[1]);
      const state = stateStore.get(getStateKey(artifactId)) ?? createFoundationState({ artifactId, title: 'KBX Canvas' });
      const html = renderCanvasDocument(state);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    const apiMatch = pathname.match(/^\/api\/canvas\/([^/]+)$/);
    if (apiMatch && req.method === 'GET') {
      const artifactId = decodeURIComponent(apiMatch[1]);
      const state = stateStore.get(getStateKey(artifactId)) ?? createFoundationState({ artifactId, title: 'KBX Canvas' });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(state));
      return;
    }

    if (apiMatch && req.method === 'POST') {
      const artifactId = decodeURIComponent(apiMatch[1]);
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const action = parsed.action ?? 'set_state';
          const payload = parsed.payload ?? {};
          const current = stateStore.get(getStateKey(artifactId)) ?? createFoundationState({ artifactId, title: 'KBX Canvas' });
          const nextState = applyAction(current, action, payload);
          stateStore.set(getStateKey(artifactId), nextState);
          sendEvent(getStateKey(artifactId), 'state', nextState);
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(nextState));
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
      return;
    }

    const eventMatch = pathname.match(/^\/api\/canvas\/([^/]+)\/events$/);
    if (eventMatch) {
      const artifactId = getStateKey(decodeURIComponent(eventMatch[1]));
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      });
      res.write(`retry: 1000\n\n`);

      const listeners = subscribers.get(artifactId) ?? [];
      listeners.push(res);
      subscribers.set(artifactId, listeners);

      const state = stateStore.get(artifactId) ?? createFoundationState({ artifactId, title: 'KBX Canvas' });
      res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);

      req.on('close', () => {
        const remaining = (subscribers.get(artifactId) ?? []).filter((writer) => writer !== res);
        subscribers.set(artifactId, remaining);
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    port: address.port,
    server,
    stateStore,
    close: () => new Promise((resolve, reject) => {
      for (const listeners of subscribers.values()) {
        for (const writer of listeners) {
          try {
            writer.end();
          } catch (error) {
            // ignore closed response streams during shutdown
          }
        }
      }
      subscribers.clear();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
  };
}
