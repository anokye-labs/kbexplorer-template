/**
 * Scenario: slow
 * Adds a 3-second delay to every response. Tests loading states and timeouts.
 */
const DELAY_MS = 3000;

export function intercept(req, res) {
  if (req.method === 'OPTIONS') return false;

  return new Promise((resolve) => {
    setTimeout(() => resolve(false), DELAY_MS);
  });
}
