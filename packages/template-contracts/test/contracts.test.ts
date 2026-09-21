import { describe, expect, it } from 'vitest';
import { PRESENTATION_BOUNDARY_POLICY, TEMPLATE_KEYS } from '../src';

describe('template contracts', () => {
  it('exports the three template keys in canonical order', () => {
    expect(TEMPLATE_KEYS).toEqual(['atlas', 'brief', 'field-guide']);
  });

  it('exports the presentation-only boundary policy contract', () => {
    expect(PRESENTATION_BOUNDARY_POLICY).toEqual({
      forbiddenRootSourcePrefixes: ['src/engine', 'src/representation/targets'],
      forbiddenTemplateInternalSubpaths: ['/src/', '/test/'],
    });
  });
});
