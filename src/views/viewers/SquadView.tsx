import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row, ScalarList } from './spine-shared';
import { dataOf, arrayField } from './spine-data';

/**
 * Bespoke viewer for `squad` entities (F2 / T2.5 — #164).
 *
 * Surfaces the squad's mission, DRI (lead), members it staffs, the workstream it
 * delivers and its knowledge areas. Relationships also render as graph edges; the
 * viewer shows the referenced handles for quick scanning.
 */
export function SquadView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const mission = d.mission as string | undefined;
  const dri = d.dri as string | undefined;
  const workstream = d.workstream as string | undefined;
  const members = arrayField(d, 'members');
  const areas = arrayField(d, 'knowledgeAreas');

  return (
    <div className="kb-structured-view kb-squad-view">
      <EntityHeader label="Squad" id={node.jsonld?.['@id'] as string | undefined} />
      <h2 className="kb-entity-name">{name}</h2>
      {mission && <p className="kb-entity-tagline">{mission}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="DRI">{dri && <code className="kb-structured-code">@{dri}</code>}</Row>
          <Row label="Delivers">{workstream}</Row>
          <Row label="Members"><ScalarList items={members} /></Row>
          <Row label="Knowledge areas"><ScalarList items={areas} /></Row>
        </tbody>
      </table>
    </div>
  );
}
