import { useEffect } from 'react';
import type { KBConfig } from '../types';
import { resolveImageUrl } from '../api';

/** Minimal element target that exposes the attribute API we need (testable without a DOM). */
export type IconLinkTarget = {
  setAttribute(name: string, value: string): void;
};

/** Minimal document target so this is testable without jsdom. */
export type FaviconDocTarget = {
  querySelector(selector: string): IconLinkTarget | null;
  createElement(tag: string): IconLinkTarget;
  head: { appendChild(el: IconLinkTarget): void };
};

/**
 * Swap the document's `<link rel="icon">` href to the resolved favicon URL.
 *
 * When `href` is null/empty the function is a no-op so the static default in
 * index.html (`/favicon.svg`) is left untouched. When the link element is
 * missing it is created and appended to <head>.
 */
export function applyFavicon(href: string | null | undefined, doc?: FaviconDocTarget): void {
  if (!href) return;
  const target = doc ?? (typeof document !== 'undefined' ? (document as unknown as FaviconDocTarget) : undefined);
  if (!target) return;

  let link = target.querySelector('link[rel="icon"]');
  if (!link) {
    link = target.createElement('link');
    link.setAttribute('rel', 'icon');
    target.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * React hook that swaps the document favicon from `config.branding.favicon`
 * (resolved via resolveImageUrl, same host-repo asset path the logo uses) once
 * config is available. Unset favicon leaves the default /favicon.svg in place.
 */
export function useFavicon(config: KBConfig | undefined): void {
  const favicon = config?.branding?.favicon;
  const href = favicon && config ? resolveImageUrl(config.source, favicon) : null;
  useEffect(() => {
    applyFavicon(href);
  }, [href]);
}
