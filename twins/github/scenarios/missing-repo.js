/**
 * Scenario: missing-repo
 * Returns 404 for all routes. Tests error handling when the repo doesn't exist.
 */
export function intercept(req, res) {
  if (req.method === 'OPTIONS') return false;

  res.writeHead(404, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    message: 'Not Found',
    documentation_url: 'https://docs.github.com/rest',
  }));
  return true;
}
