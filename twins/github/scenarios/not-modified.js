/**
 * Scenario: not-modified
 * Returns 304 Not Modified when the request includes an If-None-Match header.
 * Tests ETag/cache behavior.
 */
export function intercept(req, res) {
  if (req.headers['if-none-match']) {
    res.writeHead(304, {
      'ETag': req.headers['if-none-match'],
      'Access-Control-Allow-Origin': '*',
      'X-RateLimit-Remaining': '59',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    });
    res.end();
    return true;
  }
  return false;
}
