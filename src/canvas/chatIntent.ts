/**
 * Bidirectional click → chat: the `/chat-intent` client (#410, epic #407).
 *
 * The reverse direction of #409 (agent → panel). A click in the canvas becomes
 * the next chat turn: the client POSTs a small intent envelope to a loopback
 * endpoint the CLI exposes (`anokye-labs/kbexplorer-cli#195`, "Click→chat seam
 * (Lane B)" — open as of this PR, 0 comments), which translates it into an
 * agent chat turn / tool call. This module owns ONLY the client call + the
 * intent catalog; it never talks to `/affordance/:name` or any other mutating
 * endpoint — that is the whole point of the consent-routing rule in #410's
 * issue body ("mutating intents MUST route through the agent chat turn, never
 * a direct mutating POST from the iframe"). Because this is the ONLY function
 * in this module that performs a network write, and it only ever targets
 * `/chat-intent`, there is no code path here that could issue a direct
 * mutating `/affordance` POST.
 *
 * `#195` has not landed yet (verified via `gh issue view` before writing this),
 * so `postChatIntent` is deliberately defensive: any non-2xx response, a
 * network failure, or a malformed response body all resolve to `{ status:
 * 'unavailable' }` rather than throwing — the acceptance criterion "graceful
 * no-op + a visible hint when the endpoint is absent (older CLI)" from #410.
 */
import type { CanvasBootConfig } from './bootConfig';

/** A single clickable intent — deliberately an open catalog, not a fixed enum. */
export interface NodeIntentAction {
  /** Stable id sent as `intent` in the request body (e.g. `'pin'`). */
  id: string;
  /** Human-readable button label. */
  label: string;
  /** Optional free-text prompt hint forwarded to the agent alongside the id. */
  prompt?: string;
}

/**
 * The three intents named in #410's issue body. Extensible, not exhaustive —
 * callers may pass their own {@link NodeIntentAction} list; this default is a
 * convenience, not a hardcoded ceiling.
 */
export const DEFAULT_NODE_INTENT_ACTIONS: readonly NodeIntentAction[] = [
  { id: 'pin', label: 'Pin as anchor' },
  { id: 'derives', label: 'What derives from this?', prompt: 'What derives from this node?' },
  { id: 'affected', label: 'Show affected', prompt: 'What would be affected by a change here?' },
];

/** Request body for `POST /chat-intent`, per #410's proposed contract. */
export interface ChatIntentRequest {
  intent: string;
  nodeId: string;
  prompt?: string;
}

export type ChatIntentOutcome =
  | { status: 'ok' }
  | { status: 'unavailable' };

/**
 * Derive the `/chat-intent` URL from the boot config — same-origin-relative
 * reasoning as `useCanvasEvents.ts`'s `resolveEventsUrl` (the loopback server
 * serves the canvas entry, its assets, and its API endpoints from one origin).
 */
export function resolveChatIntentUrl(
  boot: Pick<CanvasBootConfig, 'searchServiceUrl'>,
): string {
  if (boot.searchServiceUrl) {
    try {
      return `${new URL(boot.searchServiceUrl).origin}/chat-intent`;
    } catch {
      // Malformed searchServiceUrl — fall through to the relative default.
    }
  }
  return '/chat-intent';
}

/** The minimal `fetch`-like surface this module depends on (for tests). */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

/**
 * POST an intent to `/chat-intent`. Never throws: a network failure, a
 * non-2xx response (including a 404 from an older CLI that predates #195), or
 * any other rejection all resolve to `{ status: 'unavailable' }` so the caller
 * can show a graceful hint instead of an app-level error.
 */
export async function postChatIntent(
  url: string,
  request: ChatIntentRequest,
  fetchImpl: FetchLike = fetch,
): Promise<ChatIntentOutcome> {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return res.ok ? { status: 'ok' } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
