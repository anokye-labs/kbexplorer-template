import { useEffect } from 'react';
import type { KBConfig } from '../types';
import { resolveImageUrl } from '../api';

/** Marker attribute on the single managed override <link>, so we can find/update/remove it idempotently. */
export const CSS_OVERRIDE_ATTR = 'data-kbe-css-override';

/** Minimal element target that exposes the attribute API we need (testable without a DOM). */
export type CssLinkTarget = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  remove(): void;
};

/** Minimal document target so this is testable without jsdom. */
export type CssDocTarget = {
  querySelector(selector: string): CssLinkTarget | null;
  createElement(tag: string): CssLinkTarget;
  head: { appendChild(el: CssLinkTarget): void };
};

/**
 * Inject (or update/remove) the host repo's raw CSS override sheet as a single
 * managed `<link rel="stylesheet">` appended LAST to <head> so its declarations
 * win the cascade over FluentProvider and the app's own styles.
 *
 * - When `href` is set: create the link if missing (tagged with
 *   {@link CSS_OVERRIDE_ATTR}) and point it at `href`. The href is only written
 *   when it changes, so re-renders don't trigger a needless re-fetch.
 * - When `href` is null/empty: remove any previously injected link so flipping
 *   the config back to unset cleanly tears the override down.
 * - The element is never duplicated: it is keyed by {@link CSS_OVERRIDE_ATTR}.
 */
export function applyCssOverride(href: string | null | undefined, doc?: CssDocTarget): void {
  const target = doc ?? (typeof document !== 'undefined' ? (document as unknown as CssDocTarget) : undefined);
  if (!target) return;

  const selector = `link[${CSS_OVERRIDE_ATTR}]`;
  let link = target.querySelector(selector);

  if (!href) {
    if (link) link.remove();
    return;
  }

  if (!link) {
    link = target.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute(CSS_OVERRIDE_ATTR, '');
    target.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
}

/**
 * React hook that injects `config.branding.css` (resolved via resolveImageUrl,
 * the same host-repo asset path the logo/favicon use) as the last stylesheet in
 * <head>. Unset css injects nothing and removes any previously injected sheet.
 */
export function useCssOverride(config: KBConfig | undefined): void {
  const css = config?.branding?.css;
  const href = css && config ? resolveImageUrl(config.source, css) : null;
  useEffect(() => {
    applyCssOverride(href);
  }, [href]);
}
