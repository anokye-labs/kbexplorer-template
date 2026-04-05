import { Spinner, Body1, makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
  },
});

export function LoadingScreen() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Spinner size="large" />
      <Body1>Loading knowledge base…</Body1>
    </div>
  );
}
