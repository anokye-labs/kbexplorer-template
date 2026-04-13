/**
 * Scenario: not-modified
 * Returns 304 Not Modified when the request includes an If-None-Match header.
 * Tests ETag/cache behavior.
 */
export function intercept(req, res) {
  const clientEtag = req.headers['if-none-match'];
  // Only return 304 if the ETag actually matches our fixture ETag
  if (clientEtag && (clientEtag === '"fixture-etag"' || clientEtag.includes('fixture'))) {
    res.writeHead(304, {
      'ETag': clientEtag,
      'Access-Control-Allow-Origin': '*',
      'X-RateLimit-Remaining': '59',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
    });
    res.end();
    return true;
  }
  return false;
}
