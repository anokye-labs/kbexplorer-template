import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row } from './spine-shared';
import { dataOf } from './spine-data';

/**
 * Bespoke viewer for `cycle` entities (F2 / T2.6 — #165).
 *
 * Shows the cycle's start and end dates.
 */
export function CycleView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const start = d.start as string | undefined;
  const end = d.end as string | undefined;

  return (
    <div className="kb-structured-view kb-cycle-view">
      <EntityHeader label="Cycle" id={node.jsonld?.['@id'] as string | undefined} />
      <h2 className="kb-entity-name">{name}</h2>
      <table className="kb-structured-table">
        <tbody>
          <Row label="Starts"><time>{start}</time></Row>
          <Row label="Ends"><time>{end}</time></Row>
        </tbody>
      </table>
    </div>
  );
}
