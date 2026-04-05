import {
  MessageBar,
  MessageBarBody,
  Button,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

interface ErrorScreenProps {
  message: string;
}

/** Extract a rate-limit reset time from common GitHub error messages. */
function parseRateLimitReset(message: string): string | null {
  const match = message.match(/rate limit.*?reset.*?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})/i)
    ?? message.match(/retry after (\d+)/i);
  if (!match) return null;

  if (/^\d+$/.test(match[1])) {
    const seconds = parseInt(match[1], 10);
    const resetAt = new Date(Date.now() + seconds * 1000);
    return resetAt.toLocaleTimeString();
  }
  return new Date(match[1]).toLocaleTimeString();
}

function isRateLimitError(message: string): boolean {
  return /rate.?limit/i.test(message) || /403.*limit/i.test(message);
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
  },
  messageBar: {
    maxWidth: '500px',
  },
  rateLimit: {
    color: tokens.colorNeutralForeground3,
  },
});

export function ErrorScreen({ message }: ErrorScreenProps) {
  const classes = useStyles();
  const rateLimitReset = parseRateLimitReset(message);
  const isRateLimit = isRateLimitError(message);

  return (
    <div className={classes.root}>
      <MessageBar intent="error" className={classes.messageBar}>
        <MessageBarBody>{message}</MessageBarBody>
      </MessageBar>
      {isRateLimit && (
        <Caption1 className={classes.rateLimit}>
          {rateLimitReset
            ? `Rate limit resets at ${rateLimitReset}`
            : 'GitHub API rate limit exceeded. Try again in a few minutes.'}
        </Caption1>
      )}
      <Button
        appearance="primary"
        onClick={() => window.location.reload()}
      >
        Retry
      </Button>
    </div>
  );
}
