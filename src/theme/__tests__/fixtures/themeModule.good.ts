/**
 * Local fixture for the T5.3 theme-module loader tests: a host JS theme module
 * that exports a fully-built Fluent `Theme` (named export `theme`) plus a `name`.
 * Resolves to a real Theme via createDarkTheme + a deterministic brand ramp.
 */
import { createDarkTheme, type Theme } from '@fluentui/react-components';
import { generateBrandVariants } from '../../brandRamp';

export const name = 'fixture-forest';

export const theme: Theme = {
  ...createDarkTheme(generateBrandVariants('#2E7D32')),
  colorNeutralBackground1: '#0B1A0B',
};
