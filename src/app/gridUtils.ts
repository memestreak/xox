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
