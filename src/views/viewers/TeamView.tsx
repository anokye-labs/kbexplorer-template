import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row, ScalarList } from './spine-shared';
import { arrayField, dataOf, nativeTypeOf } from './spine-data';

/**
 * Bespoke viewer for `team` entities (work-graph vocabulary — #233).
 *
 * Shows the team name, description, lead, and member list.
 */
export function TeamView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const description = d.description as string | undefined;
  const lead = d.lead as string | undefined;
  const members = arrayField(d, 'members');
  const workstreams = arrayField(d, 'workstreams');

  return (
    <div className="kb-structured-view kb-team-view">
      <EntityHeader label="Team" id={node.jsonld?.['@id'] as string | undefined} native={nativeTypeOf(node)} />
      <h2 className="kb-entity-name">{name}</h2>
      {description && <p className="kb-entity-tagline">{description}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="Lead">{lead}</Row>
          <Row label="Members"><ScalarList items={members} /></Row>
          <Row label="Workstreams"><ScalarList items={workstreams} /></Row>
        </tbody>
      </table>
    </div>
  );
}
