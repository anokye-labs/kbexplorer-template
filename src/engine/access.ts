/**
 * Shim — re-exports the access render-gate from `@anokye-labs/kbexplorer-engine`
 * (moved in anokye-labs/kbexplorer-template#472, slice 1/5). Temporary
 * git-commit-pinned dependency until the package is published to npm.
 */
export {
  isAccessWithheld,
  filterAccessWithheld,
  parseAccessLabel,
} from '@anokye-labs/kbexplorer-engine';
