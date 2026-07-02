import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NODE_INTENT_ACTIONS,
  postChatIntent,
  resolveChatIntentUrl,
  type FetchLike,
} from '../chatIntent';

describe('resolveChatIntentUrl', () => {
  it('defaults to a same-origin-relative /chat-intent', () => {
    expect(resolveChatIntentUrl({})).toBe('/chat-intent');
  });

  it('uses the searchServiceUrl origin when present and parseable', () => {
    expect(resolveChatIntentUrl({ searchServiceUrl: 'http://localhost:5555/search' })).toBe(
      'http://localhost:5555/chat-intent',
    );
  });

  it('falls back to the relative default for a malformed searchServiceUrl', () => {
    expect(resolveChatIntentUrl({ searchServiceUrl: 'not a url' })).toBe('/chat-intent');
  });
});

describe('DEFAULT_NODE_INTENT_ACTIONS', () => {
  it("names the three intents from #410's issue body", () => {
    const ids = DEFAULT_NODE_INTENT_ACTIONS.map(a => a.id);
    expect(ids).toEqual(['pin', 'derives', 'affected']);
  });

  it('is an open catalog (a plain array), not a fixed enum', () => {
    // Callers can spread/extend it — no readonly-tuple-of-exactly-3 trap.
    const extended = [...DEFAULT_NODE_INTENT_ACTIONS, { id: 'custom', label: 'Custom' }];
    expect(extended).toHaveLength(4);
  });
});

describe('postChatIntent', () => {
  const request = { intent: 'pin', nodeId: 'readme' };

  it('resolves ok on a 2xx response and POSTs the exact intent body', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200 });
    const outcome = await postChatIntent('/chat-intent', request, fetchImpl);
    expect(outcome).toEqual({ status: 'ok' });
    expect(fetchImpl).toHaveBeenCalledWith('/chat-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  });

  it('resolves unavailable on a 404 (older CLI without #195)', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: false, status: 404 });
    const outcome = await postChatIntent('/chat-intent', request, fetchImpl);
    expect(outcome).toEqual({ status: 'unavailable' });
  });

  it('resolves unavailable on a network rejection, never throws', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(postChatIntent('/chat-intent', request, fetchImpl)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('forwards an optional prompt when supplied', async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValue({ ok: true, status: 200 });
    const withPrompt = { intent: 'derives', nodeId: 'readme', prompt: 'What derives from this?' };
    await postChatIntent('/chat-intent', withPrompt, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/chat-intent',
      expect.objectContaining({ body: JSON.stringify(withPrompt) }),
    );
  });
});
