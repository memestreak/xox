import type { TrackId } from './types';

export interface CellHit {
  trackId: TrackId;
  stepIndex: number;
}

/**
 * Find the track and step under a point using
 * data-track and data-step attributes. Walks up
 * from the element at the point to find both.
 *
 * Returns null if the point is outside all cells.
 */
export function cellFromPoint(
  clientX: number,
  clientY: number
): CellHit | null {
  const el = document.elementFromPoint(
    clientX, clientY
  );
  if (!el) return null;

  let node: Element | null = el;
  while (
    node
    && !('step' in (node as HTMLElement).dataset)
  ) {
    node = node.parentElement;
  }
  if (!node) return null;
  const stepIndex = Number(
    (node as HTMLElement).dataset.step
  );

  while (
    node
    && !('track' in (node as HTMLElement).dataset)
  ) {
    node = node.parentElement;
  }
  if (!node) return null;
  const trackId = (
    node as HTMLElement
  ).dataset.track as TrackId;

  return { trackId, stepIndex };
}

/**
 * Find the nearest step button to a point by querying
 * all [data-step] elements within a container and
 * computing edge distance.
 *
 * Returns null if no cell is within maxDistance.
 */
export function nearestCellFromPoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  maxDistance: number,
): CellHit | null {
  const steps = container.querySelectorAll<HTMLElement>(
    '[data-step]'
  );
  let bestDist = Infinity;
  let bestEl: HTMLElement | null = null;

  for (const el of steps) {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - clientX, 0, clientX - r.right);
    const dy = Math.max(r.top - clientY, 0, clientY - r.bottom);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestEl = el;
    }
  }

  if (!bestEl || bestDist > maxDistance) return null;

  const stepIndex = Number(bestEl.dataset.step);

  let node: Element | null = bestEl;
  while (
    node
    && !('track' in (node as HTMLElement).dataset)
  ) {
    node = node.parentElement;
  }
  if (!node) return null;
  const trackId = (
    node as HTMLElement
  ).dataset.track as TrackId;

  return { trackId, stepIndex };
}

/**
 * Bresenham's line algorithm yielding all (col, row)
 * cells between two grid coordinates, inclusive of
 * both endpoints.
 */
export function* bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Generator<[number, number]> {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    yield [x0, y0];
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

/** A step cell's box, relative to its grid's top-left. */
export interface CellBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Where a track's length handle is drawn. */
export interface HandleSpot {
  /** Center of the handle, in px from the grid's left. */
  x: number;
  top: number;
  height: number;
  /** Gap between neighboring cells in that row, px. */
  gap: number;
}

/**
 * Read the boxes of a step grid's cells (its direct
 * children), relative to the grid's top-left corner.
 */
export function measureCells(grid: HTMLElement): CellBox[] {
  const origin = grid.getBoundingClientRect();
  return Array.from(grid.children, (child) => {
    const r = child.getBoundingClientRect();
    return {
      left: r.left - origin.left,
      right: r.right - origin.left,
      top: r.top - origin.top,
      bottom: r.bottom - origin.top,
    };
  });
}

function sameRow(a: CellBox, b: CellBox): boolean {
  return Math.abs(a.top - b.top) < 1;
}

/**
 * Where the length handle goes when the first `count`
 * cells are in use: centered in the gap after cell
 * `count`. After the last cell of a row there is no
 * next cell, so it sits where that gap would be, just
 * past the cell's right edge.
 *
 * Returns null if the cells have no size (not laid
 * out yet, or in tests).
 */
export function lengthHandleSpot(
  cells: CellBox[],
  count: number,
): HandleSpot | null {
  const last = cells[count - 1];
  if (!last || last.right <= last.left) return null;

  // Every row uses the same column gap, so read it
  // from the first two cells that share a row.
  let gap = 0;
  for (let i = 1; i < cells.length; i++) {
    if (sameRow(cells[i - 1], cells[i])) {
      gap = cells[i].left - cells[i - 1].right;
      break;
    }
  }

  const next = cells[count];
  const x = next && sameRow(last, next)
    ? (last.right + next.left) / 2
    : last.right + gap / 2;
  return {
    x,
    top: last.top,
    height: last.bottom - last.top,
    gap,
  };
}

/**
 * The cell count (1..cells.length) whose handle spot
 * is nearest a point given relative to the grid. The
 * row under the point wins first (rows wrap on
 * phones), then the nearest spot in that row.
 */
export function lengthFromGridPoint(
  cells: CellBox[],
  x: number,
  y: number,
): number {
  let best = 1;
  let bestDy = Infinity;
  let bestDx = Infinity;
  for (let count = 1; count <= cells.length; count++) {
    const spot = lengthHandleSpot(cells, count);
    if (!spot) continue;
    const dy = Math.max(
      spot.top - y, 0, y - (spot.top + spot.height)
    );
    const dx = Math.abs(x - spot.x);
    if (dy < bestDy || (dy === bestDy && dx < bestDx)) {
      best = count;
      bestDy = dy;
      bestDx = dx;
    }
  }
  return best;
}
