import { describe, expect, it } from 'vitest';
import { templateDescriptor } from '../src/template';

describe('template descriptor', () => {
  it('declares a route and title', () => {
    expect(templateDescriptor.route.startsWith('/')).toBe(true);
    expect(templateDescriptor.title.length).toBeGreaterThan(0);
  });
});
