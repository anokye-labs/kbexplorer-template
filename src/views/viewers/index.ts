/**
 * Public API for the viewer registry (T1.4).
 *
 * Import this barrel to register or resolve viewers. {@link GenericStructuredView}
 * is the mandatory fallback for any node type without a bespoke viewer.
 *
 * @example
 * ```ts
 * import { registerViewer, resolveViewer } from './views/viewers';
 * registerViewer('person', PersonView);
 * const Viewer = resolveViewer(node); // PersonView, or GenericStructuredView
 * ```
 */
export {
  registerViewer,
  resolveViewer,
  hasViewer,
  getRegisteredViewers,
  resetViewerRegistry,
} from './registry';

export {
  GenericStructuredView,
  type ViewerComponent,
  type ViewerProps,
} from './GenericStructuredView';

export { registerBuiltinViewers } from './builtin-map';

// Services-monorepo bespoke viewers (#275).
export { ServiceView } from './ServiceView';
export { DecisionView } from './DecisionView';
