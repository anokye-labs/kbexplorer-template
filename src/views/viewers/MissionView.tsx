import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row, Pill } from './spine-shared';
import { dataOf, arrayField } from './spine-data';

interface Metric { name?: string; target?: unknown; current?: unknown }
interface Milestone { name?: string; done?: boolean }

/**
 * Bespoke viewer for `mission` entities (F2 / T2.6 — #165).
 *
 * Surfaces status/RAG as pills and renders metrics + milestones as tables, plus
 * the cycle:squad assignment and the mission DRI.
 */
export function MissionView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const status = d.status as string | undefined;
  const rag = d.rag as string | undefined;
  const dri = d.dri as string | undefined;
  const assignment = d.assignment as string | undefined;
  const metrics = arrayField(d, 'metrics') as Metric[];
  const milestones = arrayField(d, 'milestones') as Milestone[];

  return (
    <div className="kb-structured-view kb-mission-view">
      <EntityHeader label="Mission" id={node.jsonld?.['@id'] as string | undefined} />
      <h2 className="kb-entity-name">{name}</h2>
      <div className="kb-pill-row">
        {status && <Pill value={status} />}
        {rag && <Pill value={rag} />}
      </div>
      <table className="kb-structured-table">
        <tbody>
          <Row label="DRI">{dri && <code className="kb-structured-code">@{dri}</code>}</Row>
          <Row label="Assignment">{assignment && <code className="kb-structured-code">{assignment}</code>}</Row>
        </tbody>
      </table>

      {metrics.length > 0 && (
        <table className="kb-structured-table kb-mission-metrics">
          <thead>
            <tr><th>Metric</th><th>Target</th><th>Current</th></tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr key={i}>
                <td>{m.name ?? '—'}</td>
                <td>{m.target != null ? String(m.target) : '—'}</td>
                <td>{m.current != null ? String(m.current) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {milestones.length > 0 && (
        <ul className="kb-mission-milestones">
          {milestones.map((m, i) => (
            <li key={i} className={m.done ? 'kb-milestone-done' : 'kb-milestone-open'}>
              {m.done ? '✓' : '○'} {m.name ?? `Milestone ${i + 1}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
