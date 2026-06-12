import { describe, it, expect } from 'vitest';
import {
  applyCssOverride,
  CSS_OVERRIDE_ATTR,
  type CssDocTarget,
  type CssLinkTarget,
} from '../useCssOverride';

function makeDoc(existing = false) {
  const attrs = new Map<string, string>();
  let removed = false;
  const link: CssLinkTarget = {
    getAttribute: name => (attrs.has(name) ? (attrs.get(name) as string) : null),
    setAttribute: (name, value) => { attrs.set(name, value); },
    remove: () => { removed = true; },
  };
  if (existing) {
    attrs.set('rel', 'stylesheet');
    attrs.set(CSS_OVERRIDE_ATTR, '');
  }
  const appended: CssLinkTarget[] = [];
  let created = 0;
  const doc: CssDocTarget = {
    querySelector: selector =>
      existing && selector === `link[${CSS_OVERRIDE_ATTR}]` ? link : null,
    createElement: () => { created += 1; return link; },
    head: { appendChild: el => { appended.push(el); } },
  };
  return { doc, attrs, appended, getCreated: () => created, wasRemoved: () => removed };
}

describe('applyCssOverride', () => {
  it('creates and appends a tagged <link rel="stylesheet"> when none exists', () => {
    const { doc, attrs, appended, getCreated } = makeDoc(false);

    applyCssOverride('https://example.com/overrides.css', doc);

    expect(getCreated()).toBe(1);
    expect(appended.length).toBe(1);
    expect(attrs.get('rel')).toBe('stylesheet');
    expect(attrs.has(CSS_OVERRIDE_ATTR)).toBe(true);
    expect(attrs.get('href')).toBe('https://example.com/overrides.css');
  });

  it('updates href on the existing managed link without creating a duplicate', () => {
    const { doc, attrs, appended, getCreated } = makeDoc(true);
    attrs.set('href', '/old.css');

    applyCssOverride('/new.css', doc);

    expect(getCreated()).toBe(0);
    expect(appended.length).toBe(0);
    expect(attrs.get('href')).toBe('/new.css');
  });

  it('does not rewrite href when unchanged (avoids needless re-fetch)', () => {
    const { doc, attrs } = makeDoc(true);
    attrs.set('href', '/same.css');
    let writes = 0;
    const origSet = doc.querySelector(`link[${CSS_OVERRIDE_ATTR}]`)!.setAttribute;
    const link = doc.querySelector(`link[${CSS_OVERRIDE_ATTR}]`)!;
    link.setAttribute = (n, v) => { if (n === 'href') writes += 1; origSet(n, v); };

    applyCssOverride('/same.css', doc);

    expect(writes).toBe(0);
  });

  it('removes the injected link when href is unset (null/empty/undefined)', () => {
    for (const value of [null, '', undefined]) {
      const { doc, wasRemoved } = makeDoc(true);
      applyCssOverride(value, doc);
      expect(wasRemoved()).toBe(true);
    }
  });

  it('is a no-op when href is unset and no link exists', () => {
    const { doc, appended, getCreated } = makeDoc(false);
    applyCssOverride(null, doc);
    expect(getCreated()).toBe(0);
    expect(appended.length).toBe(0);
  });

  it('is a safe no-op without a DOM (no doc and no document)', () => {
    const hadDocument = 'document' in globalThis;
    const original = (globalThis as { document?: unknown }).document;
    delete (globalThis as { document?: unknown }).document;
    try {
      expect(() => applyCssOverride('https://example.com/overrides.css')).not.toThrow();
    } finally {
      if (hadDocument) {
        (globalThis as { document?: unknown }).document = original;
      }
    }
  });
});
