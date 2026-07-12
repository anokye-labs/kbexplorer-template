/**
 * Embeddable canvas entry (#406, epic #407 / #401).
 *
 * The additive counterpart to `main.tsx`. It reads the host-injected boot config
 * from `window.__KBX_CANVAS__` and mounts the headless {@link EmbeddableApp}
 * instead of the full-page `<App/>` route tree — no HUD, favicon, or dock chrome.
 * The full-page entry is untouched; the CLI loopback server serves `canvas.html`
 * for the canvas surface.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { EmbeddableApp } from './canvas/EmbeddableApp';
import { readCanvasBootConfig } from './canvas/bootConfig';
import { registerViewers } from './views/viewers/registerViewers';

// Register the bespoke entity viewers so the copilot surface's anchor-first view
// reuses them instead of falling back to GenericStructuredView for every node
// (surface parity with `main.tsx` — kbexplorer-template#494).
registerViewers();

const boot = readCanvasBootConfig();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EmbeddableApp boot={boot} />
  </StrictMode>,
);
