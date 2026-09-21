import { describe, expect, it } from 'vitest';
import { templateDescriptor } from '../src/template';

describe('template descriptor', () => {
  it('declares the full descriptor contract', () => {
    expect(templateDescriptor.key).toBe('brief');
    expect(templateDescriptor.route.startsWith('/')).toBe(true);
    expect(templateDescriptor.title.length).toBeGreaterThan(0);
    expect(templateDescriptor.summary.length).toBeGreaterThan(0);
  });
});
