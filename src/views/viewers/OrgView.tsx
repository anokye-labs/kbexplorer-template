import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader } from './spine-shared';
import { dataOf } from './spine-data';

/**
 * Bespoke viewer for `org` entities (F2 / T2.6 — #165).
 *
 * Shows the org charter as a lead paragraph.
 */
export function OrgView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const charter = d.charter as string | undefined;

  return (
    <div className="kb-structured-view kb-org-view">
      <EntityHeader label="Org" id={node.jsonld?.['@id'] as string | undefined} />
      <h2 className="kb-entity-name">{name}</h2>
      {charter && <p className="kb-entity-charter">{charter}</p>}
    </div>
  );
}
