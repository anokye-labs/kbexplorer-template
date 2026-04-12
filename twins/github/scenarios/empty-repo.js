/**
 * Scenario: empty-repo
 * Returns empty arrays for issues, pulls, commits, and a minimal tree.
 * Tests empty-state rendering.
 */

const emptyTree = {
  sha: '0000000000000000000000000000000000000000',
  url: '',
  tree: [],
  truncated: false,
};

function respondJSON(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-RateLimit-Remaining': '59',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    'ETag': '"empty-etag"',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

export function intercept(req, res) {
  if (req.method === 'OPTIONS') return false;

  const pathname = (req.url ?? '/').split('?')[0];

  if (/\/git\/trees\//.test(pathname)) {
    respondJSON(res, 200, emptyTree);
    return true;
  }

  if (/\/(issues|pulls|commits)(\?|$)/.test(pathname)) {
    respondJSON(res, 200, []);
    return true;
  }

  // File content requests → 404 (empty repo has no files)
  if (/\/contents\//.test(pathname)) {
    respondJSON(res, 404, { message: 'Not Found' });
    return true;
  }

  return false;
}
