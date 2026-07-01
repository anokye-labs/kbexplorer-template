import { describe, expect, it } from 'vitest';
import { resolveCanvasLandingPath } from '../landing';
import type { KBConfig } from '../../types';

const cfg = (landing?: KBConfig['landing']): KBConfig =>
  ({ landing }) as unknown as KBConfig;

describe('resolveCanvasLandingPath', () => {
  it('lands on the anchor node when anchorNodeId is set', () => {
    expect(resolveCanvasLandingPath(cfg(), 'readme')).toBe('/node/readme');
  });

  it('encodes an anchor node id with special characters', () => {
    expect(resolveCanvasLandingPath(cfg(), 'kg://issue/406')).toBe(
      '/node/kg%3A%2F%2Fissue%2F406',
    );
  });

  it('falls back to the config landing when no anchor is set', () => {
    expect(resolveCanvasLandingPath(cfg())).toBe('/node/home');
    expect(resolveCanvasLandingPath(cfg({ view: 'overview' }))).toBe('/overview');
  });

  it('anchor wins over the config landing', () => {
    expect(resolveCanvasLandingPath(cfg({ view: 'overview' }), 'readme')).toBe('/node/readme');
  });
});
