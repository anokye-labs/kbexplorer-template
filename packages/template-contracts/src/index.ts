export type TemplateKey = 'atlas' | 'brief' | 'field-guide';

export interface TemplateDescriptor {
  key: TemplateKey;
  route: `/${string}`;
  title: string;
  summary: string;
}

export const TEMPLATE_KEYS: readonly TemplateKey[] = ['atlas', 'brief', 'field-guide'];

export const PRESENTATION_BOUNDARY_POLICY = {
  forbiddenRootSourcePrefixes: ['src/engine', 'src/representation/targets'],
  forbiddenTemplateInternalSubpaths: ['/src/', '/test/'],
  forbiddenDomTokens: ['window', 'document', 'HTMLElement', 'import.meta.env'],
} as const;
