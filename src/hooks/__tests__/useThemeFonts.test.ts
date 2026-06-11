import { describe, it, expect } from 'vitest';
import { applyThemeFonts, type FontStyleTarget } from '../useThemeFonts';

function makeTarget() {
  const props = new Map<string, string>();
  const target: FontStyleTarget = {
    style: {
      setProperty: (name, value) => { props.set(name, value); },
      removeProperty: (name) => { props.delete(name); },
    },
  };
  return { target, props };
}

describe('applyThemeFonts', () => {
  it('sets the three --kbe-font-* CSS vars from a config font object', () => {
    const { target, props } = makeTarget();

    applyThemeFonts(
      {
        heading: "'Comic Sans MS', cursive",
        body: "'Georgia', serif",
        mono: "'Fira Code', monospace",
      },
      target,
    );

    expect(props.get('--kbe-font-heading')).toBe("'Comic Sans MS', cursive");
    expect(props.get('--kbe-font-body')).toBe("'Georgia', serif");
    expect(props.get('--kbe-font-mono')).toBe("'Fira Code', monospace");
  });

  it('removes a var when its font is omitted so the CSS fallback applies', () => {
    const { target, props } = makeTarget();
    props.set('--kbe-font-heading', 'stale');

    applyThemeFonts({ body: "'Georgia', serif" }, target);

    expect(props.has('--kbe-font-heading')).toBe(false);
    expect(props.has('--kbe-font-mono')).toBe(false);
    expect(props.get('--kbe-font-body')).toBe("'Georgia', serif");
  });

  it('removes all vars when font config is undefined', () => {
    const { target, props } = makeTarget();
    props.set('--kbe-font-heading', 'a');
    props.set('--kbe-font-body', 'b');
    props.set('--kbe-font-mono', 'c');

    applyThemeFonts(undefined, target);

    expect(props.size).toBe(0);
  });

  it('is a safe no-op without a DOM (no root and no document)', () => {
    const hadDocument = 'document' in globalThis;
    const original = (globalThis as { document?: unknown }).document;
    // Simulate a non-browser environment (Node without jsdom).
    delete (globalThis as { document?: unknown }).document;
    try {
      expect(() => applyThemeFonts({ heading: "'X', serif" })).not.toThrow();
    } finally {
      if (hadDocument) {
        (globalThis as { document?: unknown }).document = original;
      }
    }
  });
});
