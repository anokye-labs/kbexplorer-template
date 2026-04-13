/**
 * Scenario: rate-limit
 * Returns 403 with X-RateLimit-Remaining: 0 after the 3rd request.
 * Tests that the app handles rate limiting gracefully.
 */
let requestCount = 0;

export function intercept(req, res) {
  requestCount++;
  if (requestCount > 3) {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      message: 'API rate limit exceeded',
      documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting',
    }));
    return true;
  }
  return false;
}
