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
import { useState } from 'react';
import { Button, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import {
  DEFAULT_NODE_INTENT_ACTIONS,
  postChatIntent,
  type ChatIntentRequest,
  type FetchLike,
  type NodeIntentAction,
} from '../../../canvas/chatIntent';

type IntentState = 'idle' | 'pending' | 'ok' | 'unavailable';

/** A per-action entry, tagged with the node id the request was issued for. */
interface IntentEntry {
  status: IntentState;
  /** The `nodeId` this entry's request targeted — see the staleness guard below. */
  nodeId: string;
}

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
  const [states, setStates] = useState<Record<string, IntentEntry>>({});

  // This bar is reused in place for the anchor node across `/node/:id`
  // navigations (React Router re-renders the same instance with a new
  // `nodeId`, it does not remount it). Reset the per-action outcomes whenever
  // the target node changes so a previous node's `ok`/`unavailable` badge can
  // never persist onto a different node's bar. Adjusted DURING RENDER (React's
  // "adjusting state when a prop changes" recipe, matching the
  // `prevLoadedGraph` pattern in `EmbeddableApp.tsx`) rather than in a
  // `useEffect`, to avoid the extra commit + re-render an effect-based
  // `setState` would cause (and the `react-hooks/set-state-in-effect` lint it
  // trips).
  const [prevNodeId, setPrevNodeId] = useState(nodeId);
  if (nodeId !== prevNodeId) {
    setPrevNodeId(nodeId);
    setStates({});
  }

  if (actions.length === 0) {
    return null;
  }

  const handleClick = (action: NodeIntentAction) => {
    const issuedFor = nodeId;
    setStates(prev => ({ ...prev, [action.id]: { status: 'pending', nodeId: issuedFor } }));
    const request: ChatIntentRequest = { intent: action.id, nodeId, prompt: action.prompt };
    void postChatIntent(chatIntentUrl, request, fetchImpl).then(outcome => {
      // Drop the outcome if this action's entry no longer belongs to the node
      // the request was issued for — e.g. a `nodeId` prop change (the render-
      // time reset above) cleared it, or a NEWER click for the same action id
      // already superseded it. Reading `prev` — the functional updater's
      // guaranteed-current state — makes this check race-free without a ref
      // or an effect (`prev`, unlike a closed-over prop, is never stale).
      setStates(prev =>
        prev[action.id]?.nodeId === issuedFor
          ? { ...prev, [action.id]: { status: outcome.status, nodeId: issuedFor } }
          : prev,
      );
    });
  };

  const anyUnavailable = Object.values(states).some(entry => entry.status === 'unavailable');

  return (
    <div className={styles.root} data-testid="node-intent-bar" data-node-id={nodeId}>
      <div className={styles.row}>
        {actions.map(action => {
          const state = states[action.id]?.status ?? 'idle';
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
