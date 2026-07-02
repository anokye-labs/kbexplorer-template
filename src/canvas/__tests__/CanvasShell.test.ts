import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanvasShell } from '../CanvasShell';

/**
 * CanvasShell (#412) — the narrow-column primitive every `copilot` route
 * renders inside. Structural assertions only (className-styled/Griffel, so the
 * actual token values are exercised by the Playwright ~400px visual test); this
 * covers the DOM contract downstream code/tests can rely on.
 */
describe('CanvasShell (#412)', () => {
  it('renders its children inside a single shell container', () => {
    const html = renderToStaticMarkup(
      createElement(
        CanvasShell,
        { children: createElement('p', { 'data-testid': 'child' }, 'hello') },
      ),
    );
    expect(html).toContain('data-testid="canvas-shell"');
    expect(html).toContain('data-kbx-shell="canvas"');
    expect(html).toContain('data-testid="child"');
    expect(html).toContain('hello');
  });

  it('renders exactly one shell root even with multiple children', () => {
    const html = renderToStaticMarkup(
      createElement(CanvasShell, {
        children: [
          createElement('div', { key: 'a' }, 'a'),
          createElement('div', { key: 'b' }, 'b'),
        ],
      }),
    );
    const matches = html.match(/data-testid="canvas-shell"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(html).toContain('>a<');
    expect(html).toContain('>b<');
  });
});
