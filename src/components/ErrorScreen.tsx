interface ErrorScreenProps {
  message: string;
}

/** Extract a rate-limit reset time from common GitHub error messages. */
function parseRateLimitReset(message: string): string | null {
  // GitHub rate limit messages often contain a UTC timestamp or "retry after" hint
  const match = message.match(/rate limit.*?reset.*?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})/i)
    ?? message.match(/retry after (\d+)/i);
  if (!match) return null;

  // If it's a number of seconds
  if (/^\d+$/.test(match[1])) {
    const seconds = parseInt(match[1], 10);
    const resetAt = new Date(Date.now() + seconds * 1000);
    return resetAt.toLocaleTimeString();
  }
  // If it's a timestamp
  return new Date(match[1]).toLocaleTimeString();
}

function isRateLimitError(message: string): boolean {
  return /rate.?limit/i.test(message) || /403.*limit/i.test(message);
}

export function ErrorScreen({ message }: ErrorScreenProps) {
  const rateLimitReset = parseRateLimitReset(message);
  const isRateLimit = isRateLimitError(message);

  return (
    <div className="error-screen">
      <span className="error-screen__icon" role="img" aria-label="warning">⚠️</span>
      <h1 className="error-screen__heading">Failed to load</h1>
      <p className="error-screen__message">{message}</p>
      {isRateLimit && (
        <p className="error-screen__rate-limit">
          {rateLimitReset
            ? `Rate limit resets at ${rateLimitReset}`
            : 'GitHub API rate limit exceeded. Try again in a few minutes.'}
        </p>
      )}
      <button
        className="error-screen__retry"
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );
}
