/**
 * Cluster-scoped token deltas.
 *
 * Fluent v9 exposes every design token as a CSS custom property of the same
 * name (e.g. `tokens.colorBrandBackground` === `var(--colorBrandBackground)`).
 * Setting that custom property on a wrapper element therefore overrides the
 * token for that subtree only — without mutating the global theme or the
 * document root. This helper turns a cluster's optional `tokens` delta map
 * (Fluent token name → CSS value) into a scoped CSS-variable style object that
 * can be applied via `style={...}` on a cluster-scoped container.
 */

/** A style object of scoped CSS custom properties (`--token` → value). */
export type ClusterTokenStyle = Record<`--${string}`, string>;

/**
 * Produce a scoped CSS-variable style object from a cluster's token deltas.
 *
 * Each entry is emitted as a `--<token>` custom property so it shadows the
 * matching Fluent token for descendants of the element it is applied to. Token
 * names already prefixed with `--` are kept verbatim. `undefined`/`null` values
 * are skipped. A missing or empty delta map yields an empty object (no-op), so
 * clusters without deltas leave the global theme untouched.
 */
export function clusterTokenStyle(
  tokens?: Partial<Record<string, string>>,
): ClusterTokenStyle {
  const style: ClusterTokenStyle = {};
  if (!tokens) return style;
  for (const [name, value] of Object.entries(tokens)) {
    if (value == null) continue;
    const varName = (name.startsWith('--') ? name : `--${name}`) as `--${string}`;
    style[varName] = value;
  }
  return style;
}
