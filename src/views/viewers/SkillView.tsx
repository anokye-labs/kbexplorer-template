import type { ViewerProps } from './GenericStructuredView';

/**
 * Bespoke viewer for Copilot / agent **skill** nodes — a `SKILL.md` discovered
 * under `.github/skills/**` by the StructuralProvider.
 *
 * A skill's most load-bearing field is its **when-to-use** trigger description
 * (what makes an agent reach for it), so that is surfaced first, followed by the
 * rendered guidance body. SSR-safe: the body HTML is produced by the provider's
 * markdown renderer, which escapes raw embedded HTML and neutralizes
 * script-executing link/image URLs (`javascript:`/`data:`/`vbscript:`) before it
 * ever reaches the DOM via `dangerouslySetInnerHTML`.
 */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function SkillView({ node }: ViewerProps) {
  const data = asRecord(node.data);
  const name = (typeof data.name === 'string' && data.name) || node.title;
  const version = typeof data.version === 'string' ? data.version : undefined;
  const description = typeof data.description === 'string' ? data.description.trim() : undefined;
  const body = typeof node.content === 'string' ? node.content : '';

  return (
    <div className="kb-structured-view kb-skill-view">
      <div className="kb-structured-header">
        <span className="kb-structured-type" title="JSON-LD @type">Skill</span>
        {version && <span className="kb-skill-version" title="Skill version">v{version}</span>}
        {node.jsonld?.['@id'] && <code className="kb-structured-id">{node.jsonld['@id']}</code>}
      </div>
      <h2 className="kb-skill-name">{name}</h2>

      <section className="kb-skill-trigger">
        <h3 className="kb-structured-key">When to use</h3>
        {description ? (
          <p className="kb-skill-description">{description}</p>
        ) : (
          <span className="kb-structured-empty">No trigger description declared</span>
        )}
      </section>

      {body && (
        <section
          className="kb-skill-body kb-prose"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
    </div>
  );
}
