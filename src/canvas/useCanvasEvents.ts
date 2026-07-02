/**
 * Agent action surface — `/events` SSE consumer (#409, epic #407).
 *
 * The loopback contract (`docs/canvas-loopback-contract.md` in `kbexplorer-cli`)
 * freezes `GET /events` to three event names: `ready` (connection ack, ignored
 * here), `graph-updated { nodes: [...] }`, and `anchor { nodeId }`. This module
 * is the template-side consumer: a pure, framework-agnostic subscription
 * ({@link subscribeToCanvasEvents}) plus a thin React hook ({@link useCanvasEvents})
 * that wires it into the embeddable mount's lifecycle.
 *
 * Everything here is deliberately split into pure functions so the wiring can be
 * unit-tested without a DOM/EventSource: {@link resolveEventsUrl} (URL
 * derivation), {@link applyGraphUpdatedEvent} (the view-state reducer), and
 * {@link subscribeToCanvasEvents} (event → handler wiring, given an injectable
 * `EventSource`-like factory).
 *
 * KNOWN LIMITATION (documented, not silently glossed over): `graph-updated`
 * patches fields onto nodes ALREADY present in the loaded graph; it does not
 * add brand-new nodes. The local manifest is baked in at build time, and the
 * frozen contract doesn't yet specify a full node shape (vs. a bare id) in the
 * event payload — inventing the required `content`/`connections`/`source`
 * fields for a node we've never seen would be guesswork. Introducing brand-new
 * nodes via `/manifest/slice` is real follow-up work once that shape is nailed
 * down with the CLI side.
 *
 * `expand` / `trace` / `filter` are NOT wired here: the frozen contract only
 * defines `graph-updated` / `anchor` today. Those three are proposed-but-
 * undecided per #409's own issue body ("choose one and record it in the
 * contract doc") — a decision that lives in the `kbexplorer-cli` repo and
 * needs to be relayed back, not invented unilaterally here.
 */
import { useEffect, useRef } from 'react';
import type { KBGraph, KBNode } from '../types';
import type { CanvasBootConfig } from './bootConfig';

/** Parsed handlers for the two frozen domain events. */
export interface CanvasEventHandlers {
  /** `anchor { nodeId }` — re-anchor the conversation on a node. */
  onAnchor?: (nodeId: string) => void;
  /** `graph-updated { nodes: [...] }` — apply a content/graph mutation. */
  onGraphUpdated?: (payload: unknown) => void;
  /**
   * Transport-level errors (including the frozen no-op/heartbeat-only seam
   * reconnecting, or `/events` not existing at all — e.g. this repo's own
   * `vite preview`, which has no loopback server). Never thrown; the consumer
   * decides whether/how to surface it. Omit to degrade silently.
   */
  onError?: (event: unknown) => void;
}

/** The minimal `EventSource` surface this module depends on (for fakes/tests). */
export interface CanvasEventSourceLike {
  addEventListener(type: string, listener: (event: { data: string }) => void): void;
  close(): void;
  onerror: ((event: unknown) => void) | null;
}

export type CanvasEventSourceFactory = (url: string) => CanvasEventSourceLike;

function defaultFactory(url: string): CanvasEventSourceLike {
  return new EventSource(url) as unknown as CanvasEventSourceLike;
}

/**
 * Derive the `/events` URL from the boot config. The loopback server serves
 * the canvas entry, its static assets, AND `/events` from the same origin
 * (`docs/canvas-loopback-contract.md`: "Boot config is injected server-side...
 * so the origin-relative `searchServiceUrl` is always correct"), so a bare
 * relative `/events` is correct in production. `searchServiceUrl`'s origin is
 * used when present and parseable, as a defensive belt-and-suspenders (e.g. a
 * host that serves the canvas cross-origin from its API); falls back to the
 * relative path otherwise (including when `searchServiceUrl` is absent, or in
 * this repo's own `vite preview`/tests, where there is no loopback server at
 * all and the connection is expected to fail — see `onError` above).
 */
export function resolveEventsUrl(boot: Pick<CanvasBootConfig, 'searchServiceUrl'>): string {
  if (boot.searchServiceUrl) {
    try {
      return `${new URL(boot.searchServiceUrl).origin}/events`;
    } catch {
      // Malformed searchServiceUrl — fall through to the relative default.
    }
  }
  return '/events';
}

function safeParseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

/** A candidate node patch: must at least carry the `id` it targets. */
type NodePatch = Partial<KBNode> & { id: string };

function isNodePatch(value: unknown): value is NodePatch {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { id: string }).id.length > 0
  );
}

/**
 * The `graph-updated` view-state reducer. Patches fields onto nodes already
 * present in `graph` by `id`; unknown ids, malformed entries, and non-array
 * payloads are ignored (defensive — never throws, degrades to a no-op).
 * Returns the SAME `graph` reference when nothing changed, so callers can use
 * it directly as a `setState` updater without an extra equality check.
 */
export function applyGraphUpdatedEvent(graph: KBGraph, payload: unknown): KBGraph {
  const nodesField = (payload as { nodes?: unknown } | undefined)?.nodes;
  if (!Array.isArray(nodesField) || nodesField.length === 0) return graph;

  const patches = new Map<string, NodePatch>();
  for (const candidate of nodesField) {
    if (isNodePatch(candidate)) patches.set(candidate.id, candidate);
  }
  if (patches.size === 0) return graph;

  let changed = false;
  const nodes = graph.nodes.map(node => {
    const patch = patches.get(node.id);
    if (!patch) return node;
    changed = true;
    // `id` is never overwritten by the patch — identity stays stable.
    return { ...node, ...patch, id: node.id };
  });
  return changed ? { ...graph, nodes } : graph;
}

/**
 * Open one `EventSource(url)` and wire the frozen `anchor`/`graph-updated`
 * events to `handlers`. Pure/framework-agnostic (an injectable `factory` makes
 * it unit-testable without a real `EventSource`/DOM). Returns a cleanup
 * function that closes the connection.
 */
export function subscribeToCanvasEvents(
  url: string,
  handlers: CanvasEventHandlers,
  factory: CanvasEventSourceFactory = defaultFactory,
): () => void {
  const source = factory(url);

  source.addEventListener('anchor', event => {
    const payload = safeParseJson(event.data) as { nodeId?: unknown } | undefined;
    if (typeof payload?.nodeId === 'string' && payload.nodeId.length > 0) {
      handlers.onAnchor?.(payload.nodeId);
    }
  });

  source.addEventListener('graph-updated', event => {
    handlers.onGraphUpdated?.(safeParseJson(event.data));
  });

  source.onerror = event => {
    handlers.onError?.(event);
  };

  return () => source.close();
}

/**
 * React hook wiring {@link subscribeToCanvasEvents} into a component's
 * lifecycle. Handlers are read from a ref so identity churn on every render
 * doesn't force a reconnect; only a change to `url` re-subscribes.
 */
export function useCanvasEvents(url: string, handlers: CanvasEventHandlers): void {
  const handlersRef = useRef(handlers);
  // Keep the ref current without mutating it during render (react-hooks/refs) —
  // this effect runs after every render (no deps array) purely to sync the ref.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (typeof EventSource === 'undefined') return undefined; // SSR/tests without a DOM.
    return subscribeToCanvasEvents(url, {
      onAnchor: nodeId => handlersRef.current.onAnchor?.(nodeId),
      onGraphUpdated: payload => handlersRef.current.onGraphUpdated?.(payload),
      onError: event => handlersRef.current.onError?.(event),
    });
  }, [url]);
}
