import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row } from './spine-shared';
import { dataOf } from './spine-data';

/**
 * Bespoke viewer for `priority` entities (F2 / T2.6 — #165).
 *
 * Shows the priority rank and its description.
 */
export function PriorityView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const rank = d.rank;
  const description = d.description as string | undefined;

  return (
    <div className="kb-structured-view kb-priority-view">
      <EntityHeader label="Priority" id={node.jsonld?.['@id'] as string | undefined} />
      <h2 className="kb-entity-name">{name}</h2>
      {description && <p className="kb-entity-tagline">{description}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="Rank">{rank != null ? String(rank) : null}</Row>
        </tbody>
      </table>
    </div>
  );
}
