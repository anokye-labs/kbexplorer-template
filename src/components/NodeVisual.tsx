/**
 * Visual identity system — renders node visuals across 7 surfaces × 4 modes.
 */
import type { KBNode, VisualMode, SourceConfig } from '../types';
import { resolveImageUrl } from '../api';
import {
  SparkleRegular,
  WrenchRegular,
  BugRegular,
  LightbulbRegular,
  DocumentRegular,
  QuestionCircleRegular,
  PinRegular,
  FolderRegular,
  MergeRegular,
  BranchForkRegular,
  FlagRegular,
} from '@fluentui/react-icons';

export const FLUENT_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  Sparkle: SparkleRegular,
  Wrench: WrenchRegular,
  Bug: BugRegular,
  Lightbulb: LightbulbRegular,
  Document: DocumentRegular,
  QuestionCircle: QuestionCircleRegular,
  Pin: PinRegular,
  Folder: FolderRegular,
  Merge: MergeRegular,
  BranchFork: BranchForkRegular,
  Flag: FlagRegular,
};

export function isFluentIconName(value: string): boolean {
  return FLUENT_ICONS.hasOwnProperty(value);
}

interface NodeVisualProps {
  node: KBNode;
  mode: VisualMode;
  surface: 'card' | 'header' | 'hero' | 'hud-thumb' | 'hud-bg' | 'edge-preview' | 'connection';
  source: SourceConfig;
  className?: string;
}

const SURFACE_SIZES: Record<NodeVisualProps['surface'], { width: number; height: number }> = {
  card: { width: 48, height: 48 },
  header: { width: 80, height: 80 },
  hero: { width: 0, height: 0 }, // full-width, handled by CSS
  'hud-thumb': { width: 44, height: 44 },
  'hud-bg': { width: 0, height: 0 }, // background, handled by CSS
  'edge-preview': { width: 40, height: 40 },
  connection: { width: 36, height: 36 },
};

/** Get the first letter of a title as fallback visual. */
function firstLetter(title: string): string {
  return title.charAt(0).toUpperCase();
}

/** Resolve the best available image URL for a node. */
function resolveNodeImage(
  node: KBNode,
  mode: VisualMode,
  source: SourceConfig
): string | null {
  if (mode === 'heroes' && node.image) {
    return resolveImageUrl(source, node.image);
  }
  if (mode === 'sprites' && node.sprite) {
    return resolveImageUrl(source, node.sprite);
  }
  return null;
}

export function NodeVisual({ node, mode, surface, source, className }: NodeVisualProps) {
  const imageUrl = resolveNodeImage(node, mode, source);
  const size = SURFACE_SIZES[surface];

  // Hero surface — full-bleed image with gradient overlay
  if (surface === 'hero' && mode === 'heroes' && imageUrl) {
    return (
      <div className={`kb-hero ${className ?? ''}`}>
        <img
          src={imageUrl}
          alt={node.title}
          className="kb-hero-img"
          loading="eager"
        />
        <div className="kb-hero-overlay" />
      </div>
    );
  }

  // HUD background — blurred image behind HUD bar
  if (surface === 'hud-bg' && mode === 'heroes' && imageUrl) {
    return (
      <div
        className={`kb-hud-bg ${className ?? ''}`}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  // Image-based surfaces (card, header, hud-thumb, edge-preview, connection)
  if (imageUrl && (mode === 'heroes' || mode === 'sprites')) {
    const isCircular = surface === 'hud-thumb' || surface === 'edge-preview';
    return (
      <img
        src={imageUrl}
        alt={node.title}
        width={size.width}
        height={size.height}
        loading="lazy"
        className={`kb-visual kb-visual--${surface} ${isCircular ? 'kb-visual--circular' : ''} ${className ?? ''}`}
      />
    );
  }

  // Emoji / icon mode
  if (mode === 'emoji' && node.emoji) {
    if (isFluentIconName(node.emoji)) {
      const Icon = FLUENT_ICONS[node.emoji];
      return (
        <span
          className={`kb-emoji kb-emoji--${surface} ${className ?? ''}`}
          role="img"
          aria-label={node.title}
        >
          <Icon style={{ fontSize: size.width || 24 }} />
        </span>
      );
    }
    return (
      <span
        className={`kb-emoji kb-emoji--${surface} ${className ?? ''}`}
        role="img"
        aria-label={node.title}
      >
        {node.emoji}
      </span>
    );
  }

  // Fallback — first letter
  if (mode === 'none' || !node.emoji) {
    return (
      <span className={`kb-letter kb-letter--${surface} ${className ?? ''}`}>
        {firstLetter(node.title)}
      </span>
    );
  }

  // Emoji/icon fallback for modes that lack an image
  if (node.emoji && isFluentIconName(node.emoji)) {
    const Icon = FLUENT_ICONS[node.emoji];
    return (
      <span
        className={`kb-emoji kb-emoji--${surface} ${className ?? ''}`}
        role="img"
        aria-label={node.title}
      >
        <Icon style={{ fontSize: size.width || 24 }} />
      </span>
    );
  }
  return (
    <span
      className={`kb-emoji kb-emoji--${surface} ${className ?? ''}`}
      role="img"
      aria-label={node.title}
    >
      {node.emoji}
    </span>
  );
}

/**
 * Get vis-network node configuration for a node based on visual mode.
 * Used by the graph view to configure node appearance.
 */
export function getVisNodeConfig(
  node: KBNode,
  mode: VisualMode,
  source: SourceConfig,
  clusterColor: string,
  nodeSize: number
): Record<string, unknown> {
  const imageUrl = resolveNodeImage(node, mode, source);

  if (mode === 'heroes' && imageUrl) {
    return {
      shape: 'circularImage',
      image: imageUrl,
      size: nodeSize,
      borderWidth: 2.5,
      color: {
        border: clusterColor,
        highlight: { border: '#E8C350' },
        hover: { border: '#E8C350' },
      },
      shadow: {
        enabled: true,
        color: clusterColor + '33',
        size: 18,
        x: 0,
        y: 0,
      },
    };
  }

  // Dots for sprites, emoji, none
  return {
    shape: 'dot',
    size: nodeSize,
    color: {
      background: clusterColor + '88',
      border: clusterColor,
      highlight: { background: clusterColor + 'AA', border: clusterColor },
      hover: { background: clusterColor + '99', border: clusterColor },
    },
    borderWidth: 2,
    shadow: {
      enabled: true,
      color: clusterColor + '33',
      size: 12,
      x: 0,
      y: 0,
    },
  };
}
