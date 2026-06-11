import type { ViewerProps } from './GenericStructuredView';

/** Render a simple key/value row when the value is present. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className="kb-structured-key">{label}</th>
      <td className="kb-structured-value">{children}</td>
    </tr>
  );
}

/**
 * Bespoke viewer for `person` entities (F2 / T2.5 — #164).
 *
 * Renders the spine person fields — name, role, alias handle, reporting line and
 * knowledge areas — with the email exposed as a `mailto:` link. className-styled
 * (no pixel sizing, SSR-safe) so it renders identically in tests and the app.
 */
export function PersonView({ node }: ViewerProps) {
  const d = (node.data ?? {}) as Record<string, unknown>;
  const name = (d.name as string) ?? node.title;
  const role = d.role as string | undefined;
  const email = d.email as string | undefined;
  const alias = d.alias as string | undefined;
  const manager = d.manager as string | undefined;
  const team = d.team as string | undefined;
  const areas = Array.isArray(d.knowledgeAreas) ? (d.knowledgeAreas as unknown[]) : [];

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
          {alias && <Row label="Alias"><code className="kb-structured-code">@{alias}</code></Row>}
          {team && <Row label="Team">{team}</Row>}
          {manager && <Row label="Reports to">{manager}</Row>}
          {email && (
            <Row label="Email">
              <a className="kb-structured-link" href={`mailto:${email}`}>{email}</a>
            </Row>
          )}
          {areas.length > 0 && (
            <Row label="Knowledge areas">
              <ul className="kb-structured-list">
                {areas.map((a, i) => <li key={i}>{String(a)}</li>)}
              </ul>
            </Row>
          )}
        </tbody>
      </table>
    </div>
  );
}
