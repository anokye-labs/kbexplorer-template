import type { KBNode } from '../../types';
import { GenericStructuredView } from '../viewers/GenericStructuredView';

/**
 * Frontmatter facts (Wave 0b — #427).
 *
 * Renders a rich-Markdown document's frontmatter as a **structured view** —
 * reusing {@link GenericStructuredView}, the same key/value + nested-table
 * renderer used for typed entity nodes — so frontmatter facts read consistently
 * with the rest of the app. Renders nothing when there are no facts.
 */
export function FrontmatterFacts({
  frontmatter,
}: {
  frontmatter?: Record<string, unknown>;
}) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return null;

  // Synthesize a minimal node carrying only the frontmatter in its `data` bag,
  // so GenericStructuredView renders exactly those facts (no JSON-LD header).
  const factsNode: KBNode = {
    id: 'frontmatter',
    title: 'Frontmatter',
    cluster: '',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'derived', generator: 'rich-markdown' },
    data: frontmatter,
  };

  return (
    <section className="kb-richmd-frontmatter" data-testid="richmd-frontmatter">
      <GenericStructuredView node={factsNode} />
    </section>
  );
}
