import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row } from './spine-shared';
import { dataOf } from './spine-data';

/**
 * Bespoke viewer for `workstream` entities (F2 / T2.6 — #165).
 *
 * Shows the workstream summary and the priority it is aligned to.
 */
export function WorkstreamView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const summary = d.summary as string | undefined;
  const priority = d.priority as string | undefined;

  return (
    <div className="kb-structured-view kb-workstream-view">
      <EntityHeader label="Workstream" id={node.jsonld?.['@id'] as string | undefined} />
      <h2 className="kb-entity-name">{name}</h2>
      {summary && <p className="kb-entity-tagline">{summary}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="Aligned to">{priority}</Row>
        </tbody>
      </table>
    </div>
  );
}
