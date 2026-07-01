import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import type { KBConfig, KBGraph } from '../../../types';
import { webDarkTheme } from '@fluentui/react-components';
import {
  copilotRepresentation,
  renderCopilotSurface,
} from '../copilot';
import { renderSpaRoutes, spaRepresentation, type SpaRenderOptions } from '../spa';

const EMPTY_GRAPH: KBGraph = { nodes: [], edges: [], clusters: [], related: {} };
const CONFIG = { landing: {} } as unknown as KBConfig;
const OPTIONS: SpaRenderOptions = {
  config: CONFIG,
  fluentTheme: webDarkTheme,
  landingPath: '/node/home',
};

describe('copilot representation target (B1 #440)', () => {
  it('registers under the distinct "copilot" target name', () => {
    expect(copilotRepresentation.target).toBe('copilot');
    expect(copilotRepresentation.target).not.toBe(spaRepresentation.target);
  });

  it('initially delegates to the spa route tree (reuses viewers)', () => {
    const copilotEl = renderCopilotSurface(EMPTY_GRAPH, OPTIONS) as ReactElement;
    const spaEl = renderSpaRoutes(EMPTY_GRAPH, OPTIONS) as ReactElement;
    // Same element type (the spa <Routes> tree) — copilot is a thin seam #408 replaces.
    expect(copilotEl.type).toBe(spaEl.type);
  });

  it('render() forwards through to renderCopilotSurface', () => {
    const viaTarget = copilotRepresentation.render(EMPTY_GRAPH, OPTIONS) as ReactElement;
    const direct = renderCopilotSurface(EMPTY_GRAPH, OPTIONS) as ReactElement;
    expect(viaTarget.type).toBe(direct.type);
  });
});
