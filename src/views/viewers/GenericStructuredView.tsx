import type { KBNode } from '../../types';

/**
 * A viewer renders a typed node. Viewers are registered against an
 * `entityType` (or JSON-LD `@type`) and resolved from the viewer registry, with
 * {@link GenericStructuredView} as the mandatory fallback for unknown types.
 */
export type ViewerComponent = (props: ViewerProps) => React.ReactNode;

export interface ViewerProps {
  node: KBNode;
}

/** Reserved JSON-LD keys that are surfaced separately from free-form data. */
const LD_RESERVED = new Set(['@context', '@id', '@type']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function humanizeKey(key: string): string {
  return key
    .replace(/^@/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Render a leaf scalar value. */
function ScalarValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="kb-structured-empty">—</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="kb-structured-scalar">{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//i.test(value);
    const isUrn = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    if (isUrl) {
      return (
        <a className="kb-structured-link" href={value} target="_blank" rel="noopener">
          {value}
        </a>
      );
    }
    if (isUrn) return <code className="kb-structured-code">{value}</code>;
    return <span className="kb-structured-scalar">{value}</span>;
  }
  return <span className="kb-structured-scalar">{String(value)}</span>;
}

/** Recursively render any value as a tree of key/value rows and nested tables. */
function ValueTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="kb-structured-empty">[]</span>;
    const allScalar = value.every(v => !isPlainObject(v) && !Array.isArray(v));
    if (allScalar) {
      return (
        <ul className="kb-structured-list">
          {value.map((item, i) => (
            <li key={i}><ScalarValue value={item} /></li>
          ))}
        </ul>
      );
    }
    return (
      <div className="kb-structured-array">
        {value.map((item, i) => (
          <div key={i} className="kb-structured-array-item">
            <ValueTree value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="kb-structured-empty">{'{}'}</span>;
    return (
      <table className="kb-structured-table">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <th scope="row" className="kb-structured-key">{humanizeKey(k)}</th>
              <td className="kb-structured-value"><ValueTree value={v} depth={depth + 1} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <ScalarValue value={value} />;
}

/**
 * Generic structured-data viewer — the mandatory fallback for any node type
 * without a bespoke viewer. Renders `node.data` (and any non-reserved JSON-LD
 * properties) as a key/value + nested table/tree, plus a JSON-LD header when
 * present. Works for arbitrary nested objects so coverage is never zero.
 */
export function GenericStructuredView({ node }: ViewerProps) {
  const ld = node.jsonld;
  const ldType = ld?.['@type'];
  const typeLabel = Array.isArray(ldType) ? ldType.join(', ') : (ldType ?? node.entityType);

  // Prefer the explicit data bag; otherwise fall back to non-reserved LD props.
  const data: Record<string, unknown> = node.data
    ? node.data
    : ld
      ? Object.fromEntries(Object.entries(ld).filter(([k]) => !LD_RESERVED.has(k)))
      : {};

  const hasData = Object.keys(data).length > 0;

  return (
    <div className="kb-structured-view">
      {(typeLabel || ld?.['@id']) && (
        <div className="kb-structured-header">
          {typeLabel && (
            <span className="kb-structured-type" title="JSON-LD @type">{typeLabel}</span>
          )}
          {ld?.['@id'] && (
            <code className="kb-structured-id" title="JSON-LD @id">{ld['@id']}</code>
          )}
        </div>
      )}

      {hasData ? (
        <ValueTree value={data} />
      ) : (
        <p className="kb-structured-empty">No structured data for this node.</p>
      )}
    </div>
  );
}
