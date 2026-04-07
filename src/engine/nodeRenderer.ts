/**
 * Custom vis-network node renderer — draws Fluent-style rounded shapes
 * with Fluent icon SVGs centered inside.
 */

// SVG paths for each Fluent icon (20×20 viewBox, Regular weight)
// Extracted from @fluentui/react-icons source
const ICON_PATHS: Record<string, string> = {
  Sparkle: 'M9.94 2.56a.5.5 0 0 1 .86.26l.58 3.49 3.49.58a.5.5 0 0 1 0 .98l-3.49.58-.58 3.49a.5.5 0 0 1-.98 0l-.58-3.49-3.49-.58a.5.5 0 0 1 0-.98l3.49-.58.58-3.49a.5.5 0 0 1 .12-.26ZM3.5 11a.5.5 0 0 1 .49.4l.35 2.09 2.09.35a.5.5 0 0 1 0 .98l-2.09.35-.35 2.09a.5.5 0 0 1-.98 0l-.35-2.09-2.09-.35a.5.5 0 0 1 0-.98l2.09-.35.35-2.09A.5.5 0 0 1 3.5 11Zm10-6a.5.5 0 0 1 .49.4l.22 1.3 1.3.22a.5.5 0 0 1 0 .98l-1.3.22-.22 1.3a.5.5 0 0 1-.98 0l-.22-1.3-1.3-.22a.5.5 0 0 1 0-.98l1.3-.22.22-1.3A.5.5 0 0 1 13.5 5Z',
  Wrench: 'M15.84 4.16a4 4 0 0 0-5.07-.55l-4.43 4.43a4 4 0 0 0-.55 5.07l-3.43 3.43a1 1 0 0 0 1.42 1.42l3.43-3.43a4 4 0 0 0 5.07-.55l4.43-4.43a4 4 0 0 0-.55-5.07l-2.12 2.12-1.42-1.42 2.12-2.12Z',
  Bug: 'M12.5 2a2.5 2.5 0 0 0-2.48 2.2A4 4 0 0 0 7.5 2a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 0 0-5ZM6 8.5A1.5 1.5 0 0 0 4.5 10v2A5.5 5.5 0 0 0 10 17.5 5.5 5.5 0 0 0 15.5 12v-2A1.5 1.5 0 0 0 14 8.5H6Z',
  Lightbulb: 'M10 2a5 5 0 0 0-3 9v1.5A1.5 1.5 0 0 0 8.5 14h3a1.5 1.5 0 0 0 1.5-1.5V11a5 5 0 0 0-3-9Zm-1 15.5a1 1 0 0 0 2 0V15H9v2.5Z',
  Document: 'M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.41a1 1 0 0 0-.3-.71l-4.4-4.4A1 1 0 0 0 10.59 2H6Zm5 1.5L14.5 7H12a1 1 0 0 1-1-1V3.5Z',
  QuestionCircle: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 12.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm.62-3.72c-.08.07-.17.13-.25.18a.63.63 0 0 1-.37.14.5.5 0 0 1-.5-.5c0-.52.2-.87.52-1.12.15-.12.33-.22.49-.3.44-.24.7-.45.7-.93a1.13 1.13 0 0 0-1.2-1.13c-.7 0-1.23.52-1.23 1.23a.5.5 0 0 1-1 0A2.23 2.23 0 0 1 10 6.13a2.13 2.13 0 0 1 2.2 2.12c0 1.03-.7 1.48-1.2 1.75-.15.08-.28.15-.38.23v.55Z',
  Pin: 'M10.27 2.05a.75.75 0 0 0-1.06.02L5.75 5.75a.75.75 0 0 0 1.08 1.04L8 5.62V10l-4.15 4.15a.75.75 0 1 0 1.06 1.06L10 10.12l5.09 5.09a.75.75 0 1 0 1.06-1.06L12 10V5.62l1.17 1.17a.75.75 0 1 0 1.06-1.06l-3.46-3.46a.75.75 0 0 0-.5-.22Z',
  Folder: 'M2 5.5A1.5 1.5 0 0 1 3.5 4h3.59a1.5 1.5 0 0 1 1.06.44L9.56 5.85a.5.5 0 0 0 .35.15H16.5A1.5 1.5 0 0 1 18 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9Z',
  Flag: 'M4 2a1 1 0 0 1 1 1v1.5l10.28-1.47A1 1 0 0 1 16.42 4l-1.5 5.25a1 1 0 0 1-.64.64L5 11.5V18a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Z',
  Merge: 'M7.5 3a2.5 2.5 0 0 1 1.06 4.77c.15 1.5.75 2.54 1.72 3.25C11.3 11.76 12.74 12 14 12h1.59l-1.3-1.3a.5.5 0 0 1 .71-.7l2 2c.2.2.2.5 0 .7l-2 2a.5.5 0 0 1-.71-.7L15.59 13H14c-1.4 0-3.05-.26-4.28-1.14A5.06 5.06 0 0 1 7.97 9.2 2.5 2.5 0 1 1 7.5 3Z',
  BranchFork: 'M7.5 3a2.5 2.5 0 0 1 .5 4.95v1.55c0 .83.67 1.5 1.5 1.5h1c1.66 0 3 1.34 3 3v.55a2.5 2.5 0 1 1-1 0V14c0-1.1-.9-2-2-2h-1A2.5 2.5 0 0 1 7 9.5V7.95A2.5 2.5 0 0 1 7.5 3Z',
};

export type NodeShapeType = 'circle' | 'roundedSquare' | 'roundedRect';

export const ICON_NODE_SHAPE: Record<string, NodeShapeType> = {
  Sparkle: 'circle',
  Flag: 'circle',
  Lightbulb: 'circle',
  QuestionCircle: 'circle',
  Pin: 'circle',
  Merge: 'circle',
  BranchFork: 'circle',
  Wrench: 'roundedSquare',
  Bug: 'roundedSquare',
  Document: 'roundedRect',
  Folder: 'roundedRect',
};

// Pre-rendered icon images cache
const iconImageCache = new Map<string, HTMLImageElement>();

function getIconImage(iconName: string, color: string): HTMLImageElement | null {
  const path = ICON_PATHS[iconName];
  if (!path) return null;

  const cacheKey = `${iconName}:${color}`;
  if (iconImageCache.has(cacheKey)) return iconImageCache.get(cacheKey)!;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="${path}" fill="${color}"/></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  iconImageCache.set(cacheKey, img);
  return img;
}

interface CtxRendererArgs {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  state: { selected: boolean; hover: boolean };
  style: { size: number };
}

/**
 * Creates a ctxRenderer function for a vis-network custom node.
 */
export function createNodeRenderer(
  iconName: string | undefined,
  clusterColor: string,
  nodeSize: number,
  isDark: boolean,
  label?: string,
  disconnected?: boolean,
){
  const shapeType: NodeShapeType = (iconName && ICON_NODE_SHAPE[iconName]) || 'circle';
  const iconColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';
  const iconImg = iconName ? getIconImage(iconName, iconColor) : null;
  const labelColor = isDark ? '#d6d6d6' : '#242424';
  const labelStroke = isDark ? '#1f1f1f' : '#ffffff';
  const bgFill = isDark ? '#1f1f1f' : '#ffffff';

  return function ctxRenderer({ ctx, x, y, state }: CtxRendererArgs) {
    const s = nodeSize;
    const fillAlpha = state.selected ? 0.5 : state.hover ? 0.35 : 0.2;
    const borderAlpha = state.selected ? 1.0 : state.hover ? 0.8 : 0.5;
    const borderWidth = state.selected ? 3 : 2;

    const fillColor = hexToRgba(clusterColor, fillAlpha);
    const borderColor = hexToRgba(clusterColor, borderAlpha);

    ctx.save();

    // Draw shape
    ctx.beginPath();
    if (shapeType === 'circle') {
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
    } else if (shapeType === 'roundedSquare') {
      roundRect(ctx, x - s / 2, y - s / 2, s, s, s * 0.22);
    } else {
      const w = s * 1.2;
      roundRect(ctx, x - w / 2, y - s / 2, w, s, s * 0.22);
    }
    // Opaque base so edges don't show through
    ctx.fillStyle = bgFill;
    ctx.fill();
    // Colored overlay
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();

    // Selected glow
    if (state.selected) {
      ctx.shadowColor = clusterColor;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw icon
    if (iconImg && iconImg.complete) {
      const iconSize = s * 0.55;
      ctx.drawImage(iconImg, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
    }

    // Disconnected warning: small red dot with × at top-right
    if (disconnected) {
      const r = 7;
      const dx = (shapeType === 'roundedRect' ? s * 0.6 : s / 2) - 2;
      const wx = x + dx;
      const wy = y - s / 2 + 2;
      ctx.beginPath();
      ctx.arc(wx, wy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#d13438';
      ctx.fill();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('!', wx, wy + 0.5);
    }

    // Draw label below shape
    if (label) {
      const labelY = y + s / 2 + 14;
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // Stroke for legibility
      ctx.strokeStyle = labelStroke;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(label, x, labelY);
      // Fill
      ctx.fillStyle = labelColor;
      ctx.fillText(label, x, labelY);
    }

    ctx.restore();

    const w = shapeType === 'roundedRect' ? s * 1.2 : s;
    const totalH = label ? s + 28 : s;
    return {
      drawNode: undefined,
      drawExternalLabel: undefined,
      nodeDimensions: { width: w, height: totalH },
    };
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
