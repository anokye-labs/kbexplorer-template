import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Row, ScalarList } from './spine-shared';
import { arrayField, dataOf, fkLabel, fkLabels, nativeTypeOf } from './spine-data';

/**
 * Bespoke viewer for `service` entities (Feature H — #275).
 *
 * A `service` is a deployable unit in a services monorepo. It surfaces the
 * organizational ownership + the catalog identity a platform team needs at a
 * glance: the owning team, the ServiceTree id (linked to ServiceTree / the
 * service catalog when a URL is supplied), the `catalog-info.yaml` path, and
 * the source repo path.
 *
 * className-styled only (no pixel sizing, SSR-safe) so it renders identically
 * under `renderToStaticMarkup` in tests and in the live app.
 */
export function ServiceView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const description = d.description as string | undefined;
  // `team` may be a bare id string or an inline object FK ({ id, name }).
  const team = fkLabel(d.team);
  const serviceTreeId = d.serviceTreeId as string | undefined;
  const serviceTreeUrl = d.serviceTreeUrl as string | undefined;
  const catalogInfoPath = d.catalogInfoPath as string | undefined;
  const repoPath = d.repoPath as string | undefined;
  const repoUrl = d.repoUrl as string | undefined;
  // Entries may be id strings or inline objects; drop any that carry no usable
  // name/id (the builder diagnoses these as bad-ref) so we never render a blank.
  const systemsOfRecord = fkLabels(arrayField(d, 'systems-of-record'));

  return (
    <div className="kb-structured-view kb-service-view">
      <EntityHeader label="Service" id={node.jsonld?.['@id'] as string | undefined} native={nativeTypeOf(node)} />
      <h2 className="kb-entity-name">{name}</h2>
      {description && <p className="kb-entity-tagline">{description}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="Owned by">{team}</Row>
          <Row label="ServiceTree">
            {serviceTreeUrl ? (
              <a className="kb-structured-link" href={serviceTreeUrl} target="_blank" rel="noopener noreferrer">
                {serviceTreeId ?? serviceTreeUrl}
              </a>
            ) : (
              serviceTreeId ? <code className="kb-structured-code">{serviceTreeId}</code> : null
            )}
          </Row>
          <Row label="catalog-info">
            {catalogInfoPath ? <code className="kb-structured-code">{catalogInfoPath}</code> : null}
          </Row>
          <Row label="Repo">
            {repoUrl ? (
              <a className="kb-structured-link" href={repoUrl} target="_blank" rel="noopener noreferrer">
                {repoPath ?? repoUrl}
              </a>
            ) : (
              repoPath ? <code className="kb-structured-code">{repoPath}</code> : null
            )}
          </Row>
          <Row label="Tracked in">
            {systemsOfRecord.length > 0 ? <ScalarList items={systemsOfRecord} /> : null}
          </Row>
        </tbody>
      </table>
    </div>
  );
}
