import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row } from './spine-shared';
import { dataOf, nativeTypeOf } from './spine-data';

/**
 * Bespoke viewer for `system-of-record` entities (work-graph vocabulary — #233).
 *
 * Shows the SoR name, URL, and description.
 */
export function SystemOfRecordView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const url = d.url as string | undefined;
  const description = d.description as string | undefined;

  return (
    <div className="kb-structured-view kb-sor-view">
      <EntityHeader label="System of Record" id={node.jsonld?.['@id'] as string | undefined} native={nativeTypeOf(node)} />
      <h2 className="kb-entity-name">{name}</h2>
      {description && <p className="kb-entity-tagline">{description}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="URL">
            {url ? <a className="kb-structured-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a> : null}
          </Row>
        </tbody>
      </table>
    </div>
  );
}
