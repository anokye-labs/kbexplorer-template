import type { ReactNode } from 'react';
import { FrontmatterFacts } from './FrontmatterFacts';

/**
 * Rich-Markdown document view (Wave 0b — #427).
 *
 * Composes a rich-Markdown document from its three parts:
 *  1. **frontmatter facts** — rendered in the structured view ({@link FrontmatterFacts});
 *  2. **prose** — the document body, passed as children;
 *  3. **embedded blocks** — rendered *inline within* the prose by the generalized
 *     `ProseContent` (live Mermaid, pre-built-SVG fallback, or raw-code last resort).
 *
 * The prose is injected as children rather than imported so this view stays
 * decoupled from `ReadingView` (which owns the inline-Mermaid/SVG prose walk) —
 * no circular import, and the composition is trivially testable with a stub.
 */
export function RichMarkdownDocumentView({
  frontmatter,
  children,
}: {
  frontmatter?: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <article className="kb-richmd" data-testid="richmd-document">
      <FrontmatterFacts frontmatter={frontmatter} />
      <div className="kb-richmd-body">{children}</div>
    </article>
  );
}
