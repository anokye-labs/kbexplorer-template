import type { ViewerProps } from './GenericStructuredView';
import { EntityHeader, Pill, Row, ScalarList } from './spine-shared';
import { arrayField, dataOf, fkLabels, nativeTypeOf } from './spine-data';

/**
 * Bespoke viewer for `decision` entities (Feature H — #275).
 *
 * A `decision` is an architecture decision record (ADR): an immutable,
 * point-in-time record of a choice the team made. It surfaces the deciders
 * (the people accountable for the call), the decision status as a RAG-toned
 * pill, the context that motivated it, and the work it affects.
 *
 * className-styled only (no pixel sizing, SSR-safe) so it renders identically
 * under `renderToStaticMarkup` in tests and in the live app.
 */
export function DecisionView({ node }: ViewerProps) {
  const d = dataOf(node.data);
  const name = (d.name as string) ?? node.title;
  const status = d.status as string | undefined;
  const date = d.date as string | undefined;
  const context = d.context as string | undefined;
  const consequences = d.consequences as string | undefined;
  const deciders = fkLabels(arrayField(d, 'deciders'));
  const affectsWorkstreams = arrayField(d, 'affects-workstreams');
  const affectsMissions = arrayField(d, 'affects-missions');
  // FK entries may be id strings or inline objects ({ id, name }); resolve to a
  // usable label and drop any without one so we never render "[object Object]".
  const affects = fkLabels([...affectsWorkstreams, ...affectsMissions]);

  return (
    <div className="kb-structured-view kb-decision-view">
      <EntityHeader label="Decision" id={node.jsonld?.['@id'] as string | undefined} native={nativeTypeOf(node)} />
      <h2 className="kb-entity-name">{name}</h2>
      {status && <p className="kb-entity-tagline"><Pill value={status} /></p>}
      {context && <p className="kb-decision-context">{context}</p>}
      <table className="kb-structured-table">
        <tbody>
          <Row label="Deciders">
            {deciders.length > 0 ? <ScalarList items={deciders} /> : null}
          </Row>
          <Row label="Date">{date}</Row>
          <Row label="Affects">
            {affects.length > 0 ? <ScalarList items={affects} /> : null}
          </Row>
          <Row label="Consequences">{consequences}</Row>
        </tbody>
      </table>
    </div>
  );
}
