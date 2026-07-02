/**
 * Shared defensive Markdown → HTML renderer (#446 / AF-010).
 *
 * Every node's `content` ends up in the DOM via `dangerouslySetInnerHTML`
 * (ProseContent / ReadingView), so ANY markdown that a provider renders is an
 * XSS sink for whatever source it came from — GitHub issue/PR/release bodies,
 * README files, authored docs, `.github` templates, structured-content
 * companions. StructuralProvider grew this defensive setup for `.github`
 * content in the #168 review; this module generalizes it as the ONE renderer
 * every engine markdown → HTML path uses:
 *
 *  - Raw embedded HTML is **escaped**, not parsed: `<img onerror=…>`,
 *    `<script>`, `<svg onload=…>` and friends render as visible text instead
 *    of live markup. (Trade-off, accepted in #446: legitimate embedded HTML —
 *    e.g. README badge `<img>`s — now renders escaped rather than live.)
 *  - `javascript:` / `data:` / `vbscript:` link and image targets are
 *    neutralized before rendering, so generated anchors can never carry a
 *    script-executing href/src.
 *
 * Markdown-generated markup (headings, lists, fenced code, tables, markdown
 * links/images with safe targets) renders exactly as before.
 */
import { Marked, type Token, type Tokens } from 'marked';

/** Escape raw HTML so it renders as text instead of parsing as markup. */
export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * URL schemes that can execute script when used as a link/image target.
 * Markdown such as `[x](javascript:alert(1))` would otherwise render a
 * clickable `javascript:` href once the body is injected via
 * `dangerouslySetInnerHTML`.
 */
export const DANGEROUS_URL_SCHEME = /^\s*(?:javascript|data|vbscript):/i;

const safeMarkdown = new Marked({
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(token.text ?? '');
    },
  },
  // Neutralize dangerous link/image URLs before they reach the renderer, so the
  // generated HTML can never carry a script-executing href/src.
  walkTokens(token: Token): void {
    if (token.type === 'link' || token.type === 'image') {
      const t = token as Tokens.Link | Tokens.Image;
      if (typeof t.href === 'string' && DANGEROUS_URL_SCHEME.test(t.href)) {
        t.href = '';
      }
    }
  },
});

/**
 * Render markdown to HTML with untrusted-content defenses (see module header).
 * Drop-in replacement for `marked.parse(body, { async: false })`.
 */
export function renderSafeMarkdown(body: string): string {
  return safeMarkdown.parse(body, { async: false }) as string;
}
