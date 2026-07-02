import { describe, it, expect } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import type { KBConfig, KBGraph } from '../../../types';
import { webDarkTheme } from '@fluentui/react-components';
import {
  copilotRepresentation,
  renderCopilotSurface,
  type CopilotRenderOptions,
} from '../copilot';
import { spaRepresentation } from '../spa';

const EMPTY_GRAPH: KBGraph = { nodes: [], edges: [], clusters: [], related: {} };
const CONFIG = { landing: {}, clusters: {} } as unknown as KBConfig;

function baseOptions(overrides: Partial<CopilotRenderOptions> = {}): CopilotRenderOptions {
  return {
    config: CONFIG,
    fluentTheme: webDarkTheme,
    landingPath: '/node/home',
    ...overrides,
  };
}

/** Collect the `path`/`to` props of the route tree the copilot surface renders. */
function routePaths(element: ReactElement): { paths: string[]; navigateTargets: string[] } {
  const paths: string[] = [];
  const navigateTargets: string[] = [];
  const children = (element.props as { children?: ReactNode }).children;
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const props = child.props as { path?: string; element?: ReactElement };
    if (props.path) paths.push(props.path);
    const routed = props.element;
    if (routed && isValidElement(routed)) {
      const to = (routed.props as { to?: string }).to;
      if (typeof to === 'string') navigateTargets.push(to);
    }
  });
  return { paths, navigateTargets };
}

describe('copilot representation target (B1 #440 / B2 #408)', () => {
  it('registers under the distinct "copilot" target name', () => {
    expect(copilotRepresentation.target).toBe('copilot');
    expect(copilotRepresentation.target).not.toBe(spaRepresentation.target);
  });

  it('renders an anchor-first route tree (not the constellation as landing)', () => {
    const el = renderCopilotSurface(EMPTY_GRAPH, baseOptions()) as ReactElement;
    const { paths } = routePaths(el);
    expect(paths).toContain('/node/:id'); // the anchor-first home
    expect(paths).toContain('/constellation'); // zoom-out, not landing
    expect(paths).toContain('/'); // initial redirect
  });

  it('lands on the conversation anchor when anchorNodeId is set', () => {
    const el = renderCopilotSurface(
      EMPTY_GRAPH,
      baseOptions({ anchorNodeId: 'kb://mission/x' }),
    ) as ReactElement;
    const { navigateTargets } = routePaths(el);
    expect(navigateTargets).toContain('/node/kb%3A%2F%2Fmission%2Fx');
  });

  it('falls back to the config landingPath when no anchor is supplied', () => {
    const el = renderCopilotSurface(
      EMPTY_GRAPH,
      baseOptions({ landingPath: '/node/home' }),
    ) as ReactElement;
    const { navigateTargets } = routePaths(el);
    expect(navigateTargets).toContain('/node/home');
  });

  it('render() forwards through to renderCopilotSurface', () => {
    const viaTarget = copilotRepresentation.render(EMPTY_GRAPH, baseOptions()) as ReactElement;
    const direct = renderCopilotSurface(EMPTY_GRAPH, baseOptions()) as ReactElement;
    expect(viaTarget.type).toBe(direct.type);
  });
});
