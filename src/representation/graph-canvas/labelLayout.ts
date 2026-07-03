/**
 * Label-collision layout for the force-directed constellation.
 *
 * vis-network draws node labels at a fixed offset with no neighbour awareness, so
 * adjacent labels overwrite each other while also being truncated (#435). This
 * module computes a collision-aware placement for each label in *screen space*
 * (post-layout, zoom-aware): each label tries a set of candidate anchors around its
 * node and takes the first that doesn't overlap an already-occupied rectangle (node
 * bodies + already-placed labels). If none fit, the label is hidden rather than
 * truncated — "labels at the current zoom level are not truncated when space allows;
 * placement avoids collisions (offset/anchor selection or hide-on-collide)".
 *
 * The function is pure and unit-testable: callers supply measured pixel geometry and
 * a text-size for each item; no DOM/canvas dependency lives here.
 */

export type LabelAnchor = 'below' | 'above' | 'left' | 'right';

export interface LabelItem {
  id: string;
  /** Node centre, screen pixels. */
  x: number;
  y: number;
  /** Node radius, screen pixels (half the larger of the drawn width/height). */
  radius: number;
  /** Measured label width, screen pixels. */
  width: number;
  /** Label line height, screen pixels. */
  height: number;
  /**
   * Placement priority — higher wins ties and is placed first, so prominent nodes
   * (key/high-degree, or the focused node) keep their labels when space is tight.
   */
  priority: number;
}

export interface LabelPlacement {
  anchor: LabelAnchor;
  hidden: boolean;
}

export interface AssignLabelOptions {
  /** Gap between the node border and the label box, screen pixels. Default 6. */
  gap?: number;
  /**
   * Anchor order to try, most-preferred first. Default: below, above, right, left.
   * Stops at the first non-overlapping candidate.
   */
  anchors?: LabelAnchor[];
  /**
   * Extra padding added around each label box when testing for overlap, screen
   * pixels. A little breathing room so labels don't kiss. Default 2.
   */
  padding?: number;
  /**
   * All node bodies that labels must avoid, as `{x, y, radius}` (screen pixels).
   * This MUST include unlabeled nodes too — otherwise a label could be placed over
   * a node that carries no label of its own. When omitted, the labelled `items`
   * themselves are used as the obstacle set (back-compat).
   */
  obstacles?: { x: number; y: number; radius: number }[];
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Bounding box of the label box for a given anchor around the node. */
function labelRect(item: LabelItem, anchor: LabelAnchor, gap: number, pad: number): Rect {
  const w = item.width + pad * 2;
  const h = item.height + pad * 2;
  const r = item.radius;
  switch (anchor) {
    case 'below': {
      const top = item.y + r + gap;
      return { left: item.x - w / 2, right: item.x + w / 2, top, bottom: top + h };
    }
    case 'above': {
      const bottom = item.y - r - gap;
      return { left: item.x - w / 2, right: item.x + w / 2, top: bottom - h, bottom };
    }
    case 'right': {
      const left = item.x + r + gap;
      return { left, right: left + w, top: item.y - h / 2, bottom: item.y + h / 2 };
    }
    case 'left': {
      const right = item.x - r - gap;
      return { left: right - w, right, top: item.y - h / 2, bottom: item.y + h / 2 };
    }
  }
}

/** Bounding square of a node body (radius in screen pixels). */
function nodeRect(item: { x: number; y: number; radius: number }): Rect {
  return {
    left: item.x - item.radius,
    right: item.x + item.radius,
    top: item.y - item.radius,
    bottom: item.y + item.radius,
  };
}

/**
 * Assign a collision-free placement to each label, or hide it.
 *
 * Greedy: items are placed in descending priority order (ties broken by id for
 * determinism). Occupied space starts as every node body, then each accepted label
 * box is added. For each item we try the configured anchors in order and accept the
 * first whose box clears all occupied rects; if none clear, the label is hidden.
 */
export function assignLabelPlacements(
  items: LabelItem[],
  options: AssignLabelOptions = {},
): Map<string, LabelPlacement> {
  const gap = options.gap ?? 6;
  const pad = options.padding ?? 2;
  const anchors = options.anchors ?? ['below', 'above', 'right', 'left'];

  const result = new Map<string, LabelPlacement>();

  // Every node body is a permanent obstacle — labels never overlap a node, even
  // an unlabeled one. Callers should pass the full node set via `obstacles`; we
  // fall back to the labelled items when omitted.
  const occupied: Rect[] = (options.obstacles ?? items).map(nodeRect);

  const ordered = [...items].sort((a, b) =>
    b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  for (const item of ordered) {
    let placed: LabelAnchor | null = null;
    for (const anchor of anchors) {
      const rect = labelRect(item, anchor, gap, pad);
      if (!occupied.some(o => rectsOverlap(rect, o))) {
        placed = anchor;
        occupied.push(rect);
        break;
      }
    }
    result.set(
      item.id,
      placed ? { anchor: placed, hidden: false } : { anchor: anchors[0], hidden: true },
    );
  }

  return result;
}
