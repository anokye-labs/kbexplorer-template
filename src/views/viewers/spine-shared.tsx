import type { ReactNode } from 'react';

/**
 * Shared building blocks for the content-model spine viewers (F2 / T2.5 + T2.6).
 *
 * className-styled only (no pixel sizing, SSR-safe) so the bespoke viewers render
 * identically under `renderToStaticMarkup` in tests and in the live app.
 */

/** A header strip showing the entity kind label and its JSON-LD `@id`. */
export function EntityHeader({ label, id, native }: { label: string; id?: string; native?: string }) {
  return (
    <div className="kb-structured-header">
      <span className="kb-structured-type" title="JSON-LD @type">{label}</span>
      {native && native.toLowerCase() !== label.toLowerCase() && (
        <span
          className="kb-structured-native"
          title={`Native term — this repo calls it "${native}", unified to the canonical type`}
        >
          {native}
        </span>
      )}
      {id && <code className="kb-structured-id" title="JSON-LD @id">{id}</code>}
    </div>
  );
}

/** A key/value table row, rendered only when `children` is truthy. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === '' || (Array.isArray(children) && children.length === 0)) {
    return null;
  }
  return (
    <tr>
      <th scope="row" className="kb-structured-key">{label}</th>
      <td className="kb-structured-value">{children}</td>
    </tr>
  );
}

/** A bullet list of scalar values. */
export function ScalarList({ items }: { items: unknown[] }) {
  if (!items.length) return null;
  return (
    <ul className="kb-structured-list">
      {items.map((it, i) => <li key={i}>{String(it)}</li>)}
    </ul>
  );
}

/** A small status / RAG pill whose tone maps to a className (no inline color). */
export function Pill({ value }: { value: string }) {
  const tone = ragTone(value);
  return <span className={`kb-pill kb-pill-${tone}`}>{value}</span>;
}

/** Map a status / RAG string to a tone class suffix. */
function ragTone(value: string): 'green' | 'amber' | 'red' | 'neutral' {
  const v = value.toLowerCase();
  if (/(green|on-track|done|complete|shipped|healthy)/.test(v)) return 'green';
  if (/(amber|yellow|at-risk|warn|in-progress|pending)/.test(v)) return 'amber';
  if (/(red|blocked|off-track|fail|critical)/.test(v)) return 'red';
  return 'neutral';
}

