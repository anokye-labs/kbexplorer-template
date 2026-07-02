/**
 * Per-node intent action bar (#410, epic #407).
 *
 * An extensible row of buttons for a single node — "Pin as anchor", "What
 * derives from this?", "Show affected" by default, but callers may pass any
 * {@link NodeIntentAction} list (never hardcoded to exactly three). Each click
 * POSTs to `/chat-intent` via {@link postChatIntent} — the ONLY network call
 * this component makes — so there is no code path here that could issue a
 * direct mutating `/affordance/:name` request: every intent, read-only or
 * mutating, becomes a chat turn the agent decides how to act on (#410's
 * consent-routing rule).
 *
 * States are per-action (`idle` → `pending` → `ok` | `unavailable`) so one
 * slow/failed intent doesn't block the others. `unavailable` (network failure
 * or a non-2xx, e.g. a 404 from a CLI that predates `kbexplorer-cli#195`)
 * surfaces a small persistent hint instead of throwing or silently no-oping.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import {
  DEFAULT_NODE_INTENT_ACTIONS,
  postChatIntent,
  type ChatIntentRequest,
  type FetchLike,
  type NodeIntentAction,
} from '../../../canvas/chatIntent';

type IntentState = 'idle' | 'pending' | 'ok' | 'unavailable';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface NodeIntentBarProps {
  /** The node these actions target (`ChatIntentRequest.nodeId`). */
  nodeId: string;
  /** Resolved `/chat-intent` URL (see `resolveChatIntentUrl`). */
  chatIntentUrl: string;
  /** Open, extensible action catalog — defaults to the three from #410. */
  actions?: readonly NodeIntentAction[];
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
}

/** Renders nothing when there are no actions — an empty bar is a no-op. */
export function NodeIntentBar({
  nodeId,
  chatIntentUrl,
  actions = DEFAULT_NODE_INTENT_ACTIONS,
  fetchImpl,
}: NodeIntentBarProps) {
  const styles = useStyles();
  const [states, setStates] = useState<Record<string, IntentState>>({});

  // This bar is reused in place for the anchor node across `/node/:id`
  // navigations (React Router re-renders the same instance with a new
  // `nodeId`, it does not remount it). Reset the per-action outcomes whenever
  // the target node changes so a previous node's `ok`/`unavailable` badge can
  // never persist onto a different node's bar. `nodeIdRef` additionally lets a
  // resolving `postChatIntent` promise detect that the node changed while it
  // was in flight and drop its now-stale outcome instead of painting it onto
  // the new node.
  const nodeIdRef = useRef(nodeId);
  useEffect(() => {
    nodeIdRef.current = nodeId;
    setStates({});
  }, [nodeId]);

  if (actions.length === 0) {
    return null;
  }

  const handleClick = (action: NodeIntentAction) => {
    const issuedFor = nodeId;
    setStates(prev => ({ ...prev, [action.id]: 'pending' }));
    const request: ChatIntentRequest = { intent: action.id, nodeId, prompt: action.prompt };
    void postChatIntent(chatIntentUrl, request, fetchImpl).then(outcome => {
      if (nodeIdRef.current !== issuedFor) {
        return;
      }
      setStates(prev => ({ ...prev, [action.id]: outcome.status }));
    });
  };

  const anyUnavailable = Object.values(states).some(s => s === 'unavailable');

  return (
    <div className={styles.root} data-testid="node-intent-bar" data-node-id={nodeId}>
      <div className={styles.row}>
        {actions.map(action => {
          const state = states[action.id] ?? 'idle';
          return (
            <Button
              key={action.id}
              appearance="outline"
              size="small"
              disabled={state === 'pending'}
              onClick={() => handleClick(action)}
              data-testid={`node-intent-${action.id}`}
              data-node-id={nodeId}
              data-intent-state={state}
            >
              {state === 'pending' ? 'Sending…' : action.label}
            </Button>
          );
        })}
      </div>
      {anyUnavailable && (
        <Caption1 className={styles.hint} data-testid="node-intent-unavailable-hint">
          Chat isn&apos;t connected — this canvas isn&apos;t running behind the Copilot CLI
          loopback yet.
        </Caption1>
      )}
    </div>
  );
}
