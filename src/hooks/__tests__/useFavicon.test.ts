import { describe, it, expect } from 'vitest';
import { applyFavicon, type FaviconDocTarget, type IconLinkTarget } from '../useFavicon';

function makeDoc(existing = false) {
  const attrs = new Map<string, string>();
  const link: IconLinkTarget = {
    setAttribute: (name, value) => { attrs.set(name, value); },
  };
  if (existing) attrs.set('rel', 'icon');
  const appended: IconLinkTarget[] = [];
  let created = 0;
  const doc: FaviconDocTarget = {
    querySelector: (selector) =>
      existing && selector === 'link[rel="icon"]' ? link : null,
    createElement: () => { created += 1; return link; },
    head: { appendChild: (el) => { appended.push(el); } },
  };
  return { doc, attrs, appended, getCreated: () => created };
}

describe('applyFavicon', () => {
  it('sets href on an existing <link rel="icon">', () => {
    const { doc, attrs, appended } = makeDoc(true);

    applyFavicon('https://example.com/icon.png', doc);

    expect(attrs.get('href')).toBe('https://example.com/icon.png');
    expect(appended.length).toBe(0);
  });

  it('creates and appends a <link rel="icon"> when none exists', () => {
    const { doc, attrs, appended, getCreated } = makeDoc(false);

    applyFavicon('https://example.com/icon.png', doc);

    expect(getCreated()).toBe(1);
    expect(appended.length).toBe(1);
    expect(attrs.get('rel')).toBe('icon');
    expect(attrs.get('href')).toBe('https://example.com/icon.png');
  });

  it('is a no-op when href is empty/null so the default favicon is untouched', () => {
    const { doc, attrs, appended } = makeDoc(true);

    applyFavicon(null, doc);
    applyFavicon('', doc);
    applyFavicon(undefined, doc);

    expect(attrs.has('href')).toBe(false);
    expect(appended.length).toBe(0);
  });

  it('is a safe no-op without a DOM (no doc and no document)', () => {
    const hadDocument = 'document' in globalThis;
    const original = (globalThis as { document?: unknown }).document;
    delete (globalThis as { document?: unknown }).document;
    try {
      expect(() => applyFavicon('https://example.com/icon.png')).not.toThrow();
    } finally {
      if (hadDocument) {
        (globalThis as { document?: unknown }).document = original;
      }
    }
  });
});
