import type { ViewerProps } from './GenericStructuredView';
import type { KBNode } from '../../types';
import { EntityHeader } from './spine-shared';
import { nativeTypeOf, resolveRef } from './spine-data';

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
 * A navigable link to a graph node (issue or PR).
 * Uses an anchor styled like an in-graph reference — clicking opens that
 * node's reading page without leaving the app.
 */
function NodeLink({ to, label }: { to: string; label: string }) {
  return (
    <a
      className="kb-person-work-link kb-structured-link"
      href={`#/node/${encodeURIComponent(to)}`}
      data-node-id={to}
    >
      {label}
    </a>
  );
}

/**
 * Render a foreign-key field value (e.g. a person's `manager` or `team`) as a
 * navigable graph link when it resolves to a node id via the node's JSON-LD
 * context, falling back to plain text when it cannot be resolved (e.g. a
 * work-derived person node that carries no context). SSR-safe.
 */
function RefLink({ node, kind, value }: { node: KBNode; kind: string; value: string }) {
  const to = resolveRef(node, kind, value);
  return to ? <NodeLink to={to} label={value} /> : <>{value}</>;
}

/**
 * Bespoke viewer for `person` entities (F2 / T2.5 — #164; extended #235).
 *
 * Renders the spine person fields — name, role, alias handle, reporting line
 * and knowledge areas — with the email exposed as a `mailto:` link.
 *
 * When the node carries `data.login` (i.e. it is a work-derived person node
 * or a descriptor that has been linked to GitHub activity) an "Active work"
 * section lists all assigned/authored open issues and PRs as navigable links.
 *
 * className-styled (no pixel sizing, SSR-safe) so it renders identically in
 * tests and the app.
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
  const native = nativeTypeOf(node);

  // Work-derived active items (present on work-derived person nodes; #235)
  const activeIssues = Array.isArray(d.activeIssues)
    ? (d.activeIssues as Array<{ number: number; title: string }>)
    : [];
  const activePRs = Array.isArray(d.activePRs)
    ? (d.activePRs as Array<{ number: number; title: string }>)
    : [];
  const login = d.login as string | undefined;
  const hasActiveWork = activeIssues.length > 0 || activePRs.length > 0;

  return (
    <div className="kb-structured-view kb-person-view">
      <EntityHeader label="Person" id={node.jsonld?.['@id'] as string | undefined} native={native} />
      <h2 className="kb-person-name">{name}</h2>
      {role && <p className="kb-person-role">{role}</p>}
      <table className="kb-structured-table">
        <tbody>
          {(alias ?? login) && (
            <Row label="GitHub"><code className="kb-structured-code">@{alias ?? login}</code></Row>
          )}
          {team && <Row label="Team"><RefLink node={node} kind="team" value={team} /></Row>}
          {manager && <Row label="Reports to"><RefLink node={node} kind="person" value={manager} /></Row>}
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

      {hasActiveWork && (
        <section className="kb-person-active-work">
          <h3 className="kb-person-active-work-heading">Active work</h3>
          {activeIssues.length > 0 && (
            <>
              <h4 className="kb-person-active-work-subheading">Issues</h4>
              <ul className="kb-person-work-list">
                {activeIssues.map(i => (
                  <li key={i.number}>
                    <NodeLink to={`issue-${i.number}`} label={`#${i.number}: ${i.title}`} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {activePRs.length > 0 && (
            <>
              <h4 className="kb-person-active-work-subheading">Pull Requests</h4>
              <ul className="kb-person-work-list">
                {activePRs.map(p => (
                  <li key={p.number}>
                    <NodeLink to={`pr-${p.number}`} label={`#${p.number}: ${p.title}`} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
