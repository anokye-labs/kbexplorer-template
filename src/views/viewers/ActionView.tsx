import type { ViewerProps } from './GenericStructuredView';

/**
 * Bespoke viewer for composite/JS GitHub Action nodes (F3 / #168).
 *
 * Reads the parsed `action.yml` object off `node.data` and surfaces the
 * contract that matters to callers: **inputs**, **outputs**, and how the action
 * **runs**. SSR-safe: plain elements + classNames only.
 */

interface IoEntry {
  key: string;
  description?: string;
  required?: boolean;
  default?: string;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Normalise an action `inputs:`/`outputs:` map to a stable list. */
export function extractIo(io: unknown): IoEntry[] {
  const map = asRecord(io);
  return Object.entries(map).map(([key, raw]) => {
    const entry = asRecord(raw);
    return {
      key,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      required: typeof entry.required === 'boolean' ? entry.required : undefined,
      default: typeof entry.default === 'string' ? (entry.default as string) : undefined,
    };
  });
}

function IoTable({ title, entries }: { title: string; entries: IoEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="kb-action-io">
      <h3 className="kb-structured-key">{title}</h3>
      <table className="kb-structured-table">
        <tbody>
          {entries.map(e => (
            <tr key={e.key}>
              <th scope="row" className="kb-structured-key">
                <code className="kb-structured-code">{e.key}</code>
                {e.required && <span className="kb-action-required" title="Required"> *</span>}
              </th>
              <td className="kb-structured-value">
                {e.description ?? <span className="kb-structured-empty">—</span>}
                {e.default !== undefined && (
                  <span className="kb-action-default"> (default: {e.default || '""'})</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ActionView({ node }: ViewerProps) {
  const data = asRecord(node.data);
  const name = (typeof data.name === 'string' && data.name) || node.title;
  const description = typeof data.description === 'string' ? data.description : undefined;
  const inputs = extractIo(data.inputs);
  const outputs = extractIo(data.outputs);
  const runs = asRecord(data.runs);
  const using = typeof runs.using === 'string' ? runs.using : undefined;

  return (
    <div className="kb-structured-view kb-action-view">
      <div className="kb-structured-header">
        <span className="kb-structured-type" title="JSON-LD @type">Action</span>
        {node.jsonld?.['@id'] && <code className="kb-structured-id">{node.jsonld['@id']}</code>}
      </div>
      <h2 className="kb-action-name">{name}</h2>
      {description && <p className="kb-action-description">{description}</p>}
      {using && (
        <p className="kb-action-runs">
          Runs with <code className="kb-structured-code">{using}</code>
        </p>
      )}
      <IoTable title={`Inputs (${inputs.length})`} entries={inputs} />
      <IoTable title={`Outputs (${outputs.length})`} entries={outputs} />
      {inputs.length === 0 && outputs.length === 0 && (
        <span className="kb-structured-empty">No declared inputs or outputs</span>
      )}
    </div>
  );
}
