import type { ViewerProps } from './GenericStructuredView';

/**
 * Example bespoke viewer for `person` entities — demonstrates that a registered
 * `entityType` resolves to a custom renderer (vs. the generic fallback). Used by
 * the demo-entities seam; className-styled so it is SSR-safe for tests.
 */
export function PersonView({ node }: ViewerProps) {
  const d = (node.data ?? {}) as Record<string, unknown>;
  const name = (d.name as string) ?? node.title;
  const role = d.role as string | undefined;
  const email = d.email as string | undefined;
  const team = d.team as string | undefined;

  return (
    <div className="kb-structured-view kb-person-view">
      <div className="kb-structured-header">
        <span className="kb-structured-type" title="JSON-LD @type">Person</span>
        {node.jsonld?.['@id'] && (
          <code className="kb-structured-id">{node.jsonld['@id']}</code>
        )}
      </div>
      <h2 className="kb-person-name">{name}</h2>
      {role && <p className="kb-person-role">{role}</p>}
      <table className="kb-structured-table">
        <tbody>
          {team && (
            <tr><th scope="row" className="kb-structured-key">Team</th><td className="kb-structured-value">{team}</td></tr>
          )}
          {email && (
            <tr>
              <th scope="row" className="kb-structured-key">Email</th>
              <td className="kb-structured-value">
                <a className="kb-structured-link" href={`mailto:${email}`}>{email}</a>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
