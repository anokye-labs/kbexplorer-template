import { useState, useCallback, useMemo } from 'react';
import {
  makeStyles,
  mergeClasses,
  tokens,
  Button,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Textarea,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Caption1,
  Body1,
} from '@fluentui/react-components';
import {
  EditRegular,
  CopyRegular,
  ArrowDownloadRegular,
  OpenRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import type { KBConfig, KBNode } from '../types';
import {
  resolveSourceFile,
  validateSourceContent,
  repoCoordsFromConfig,
  buildSourceEditHandoff,
  normalizeNewlines,
} from '../engine/source-edit';

const useStyles = makeStyles({
  surface: {
    // vw-based sizing keeps the editor roomy without pixel values (AGENTS rule).
    width: '72vw',
    maxWidth: '60rem',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    minWidth: 0,
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
  },
  path: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground2,
  },
  editor: {
    width: '100%',
  },
  editorArea: {
    height: '38vh',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
  },
  diff: {
    margin: 0,
    padding: tokens.spacingVerticalM,
    maxHeight: '24vh',
    overflow: 'auto',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre',
  },
  diffCode: {
    // `<code>` carries the diff lines as phrasing content inside `<pre>` (a
    // `<div>` here would be invalid HTML). It fills the box and inherits the
    // monospace + pre-whitespace from the container.
    display: 'block',
    fontFamily: 'inherit',
  },
  diffLine: {
    // Block-level spans keep each diff line on its own row while remaining
    // valid phrasing content inside `<code>`.
    display: 'block',
  },
  diffAdd: { color: tokens.colorPaletteGreenForeground1 },
  diffDel: { color: tokens.colorPaletteRedForeground1 },
  diffMeta: { color: tokens.colorNeutralForeground4 },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  note: {
    color: tokens.colorNeutralForeground3,
  },
});

interface SourceEditorProps {
  node: KBNode;
  config: KBConfig;
}

/** Colourise a unified-diff line by its leading marker (purely cosmetic). */
function diffLineClass(line: string, styles: ReturnType<typeof useStyles>): string | undefined {
  if (line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
    return styles.diffMeta;
  }
  if (line.startsWith('+')) return styles.diffAdd;
  if (line.startsWith('-')) return styles.diffDel;
  return undefined;
}

/**
 * "Edit source" affordance for a node backed by a source-of-truth file (F5).
 *
 * Renders nothing when the node has no resolvable writable file, so it is a
 * safe no-op for README / derived / structural nodes. Otherwise it surfaces a
 * button that opens an in-app editor for the **underlying YAML/JSON file** (not
 * the JSON-LD projection). On save the change is handed off to GitHub's
 * authenticated web UI as a pull request — the browser never holds a token or
 * writes to git.
 */
export function SourceEditor({ node, config }: SourceEditorProps) {
  const styles = useStyles();
  const file = resolveSourceFile(node);

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(normalizeNewlines(file?.raw ?? ''));
  const [feedback, setFeedback] = useState<string | null>(null);

  const coords = useMemo(() => repoCoordsFromConfig(config), [config]);

  const validation = useMemo(
    () => (file ? validateSourceContent(content, file.format) : { ok: true as const }),
    [content, file],
  );
  const handoff = useMemo(
    () => (file ? buildSourceEditHandoff(coords, file, content) : null),
    [coords, file, content],
  );

  const reset = useCallback(() => {
    setContent(normalizeNewlines(file?.raw ?? ''));
    setFeedback(null);
  }, [file]);

  const copyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setFeedback('Edited content copied to your clipboard.');
    } catch {
      setFeedback('Could not access the clipboard — select the text and copy manually.');
    }
  }, [content]);

  const downloadPatch = useCallback(() => {
    if (!handoff || !handoff.patch) return;
    const blob = new Blob([handoff.patch], { type: 'text/x-patch' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = handoff.patchName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [handoff]);

  const openPr = useCallback(async () => {
    if (!handoff) return;
    // For an existing file GitHub's editor opens with the *current* content, so
    // copy the edited text first to let the user paste it in one move.
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      /* clipboard unavailable — the user can still download the patch */
    }
    window.open(handoff.url, '_blank', 'noopener');
  }, [handoff, content]);

  if (!file) return null;

  const canHandoff = validation.ok && (handoff?.changed ?? false);

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        setOpen(data.open);
        if (data.open) reset();
      }}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="subtle" size="small" icon={<EditRegular />} data-testid="edit-source-trigger">
          Edit source
        </Button>
      </DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>Edit source</DialogTitle>
          <DialogContent className={styles.body}>
            <div className={styles.meta}>
              <code className={styles.path}>{file.path}</code>
              <Caption1>
                → {coords.owner}/{coords.repo} · {coords.branch} · {file.format.toUpperCase()}
              </Caption1>
            </div>

            <Body1 className={styles.note}>
              You&apos;re editing the underlying source-of-truth file, not the projected
              view. Saving opens the change as a pull request on GitHub — kbexplorer never
              writes to your repo or stores any credentials.
            </Body1>

            <Textarea
              className={styles.editor}
              textarea={{ className: styles.editorArea, 'aria-label': `Source for ${file.path}` }}
              resize="vertical"
              value={content}
              onChange={(_, data) => {
                setContent(data.value);
                setFeedback(null);
              }}
            />

            {!validation.ok && (
              <MessageBar intent="error">
                <MessageBarBody>
                  <MessageBarTitle>Invalid {file.format.toUpperCase()}</MessageBarTitle>
                  {validation.error}
                </MessageBarBody>
              </MessageBar>
            )}

            {validation.ok && handoff && !handoff.changed && (
              <MessageBar intent="info">
                <MessageBarBody>No changes yet — edit a field to enable the pull-request handoff.</MessageBarBody>
              </MessageBar>
            )}

            {validation.ok && handoff?.changed && handoff.patch && (
              <pre className={styles.diff} data-testid="source-diff">
                <code className={styles.diffCode}>
                  {handoff.patch.split('\n').map((line, i) => (
                    <span key={i} className={mergeClasses(styles.diffLine, diffLineClass(line, styles))}>
                      {line || '\u00a0'}
                    </span>
                  ))}
                </code>
              </pre>
            )}

            {feedback && (
              <MessageBar intent="success">
                <MessageBarBody>{feedback}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>
          <DialogActions className={styles.actions}>
            <Button
              appearance="primary"
              icon={<OpenRegular />}
              disabled={!canHandoff}
              onClick={openPr}
              data-testid="open-pr"
            >
              Open PR on GitHub
            </Button>
            <Button appearance="secondary" icon={<CopyRegular />} onClick={copyContent}>
              Copy content
            </Button>
            <Button
              appearance="secondary"
              icon={<ArrowDownloadRegular />}
              disabled={!canHandoff}
              onClick={downloadPatch}
            >
              Download .patch
            </Button>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<DismissRegular />}>Close</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
