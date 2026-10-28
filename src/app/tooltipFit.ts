/** Left and right edges, in viewport px. */
export interface Span {
  left: number;
  right: number;
}

/**
 * The visible horizontal band for `el`: the window,
 * narrowed by every ancestor that clips overflow (such
 * as the scrolling track area).
 */
export function visibleBand(el: HTMLElement): Span {
  let left = 0;
  let right = document.documentElement.clientWidth
    || window.innerWidth;
  for (
    let node = el.parentElement;
    node && node !== document.body;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (
      style.overflowX !== 'visible'
      || style.overflowY !== 'visible'
    ) {
      const rect = node.getBoundingClientRect();
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
    }
  }
  return { left, right };
}

/**
 * How far to move a tooltip sideways so it sits inside
 * `band`, keeping `margin` px from the edge. A tooltip
 * wider than the band lines up with its left edge.
 */
export function tooltipShift(
  tip: Span,
  band: Span,
  margin: number,
): number {
  const minLeft = band.left + margin;
  const maxRight = band.right - margin;
  if (tip.left < minLeft) return minLeft - tip.left;
  if (tip.right > maxRight) {
    return Math.max(
      maxRight - tip.right,
      minLeft - tip.left,
    );
  }
  return 0;
}
