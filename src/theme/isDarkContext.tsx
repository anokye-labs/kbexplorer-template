/**
 * IsDarkContext — broadcasts whether the active theme renders on a dark
 * background to the entire component tree without prop-drilling.
 *
 * Provided by App (which has the resolved FluentTheme) and consumed by any
 * component that needs to adapt contrast for light / sepia / ocean themes.
 * Defaults to `true` (dark) so components outside a provider keep the
 * existing dark-palette behaviour.
 */
import { createContext, useContext } from 'react';

export const IsDarkContext = createContext<boolean>(true);

/** Read whether the active theme is dark from the nearest IsDarkContext. */
export function useIsDark(): boolean {
  return useContext(IsDarkContext);
}
