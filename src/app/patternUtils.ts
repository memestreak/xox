import type { Pattern, TrackConfig, TrackId } from './types';
import { TRACK_IDS } from './types';
import { PATTERN_LIST_COLUMNS } from './constants';

/**
 * A group of patterns sharing the same category.
 */
export interface PatternCategory {
  category: string;
  patterns: Pattern[];
}

/**
 * Group patterns by their `category` field, sorted
 * alphabetically with "Other" pinned to the end.
 *
 * @param patterns - Array of patterns to categorize
 * @returns Array of category groups, sorted A-Z,
 *   "Other" last
 */
export function getCategorizedPatterns(
  patterns: Pattern[]
): PatternCategory[] {
  const map = new Map<string, Pattern[]>();
  for (const p of patterns) {
    const cat = p.category ?? 'Other';
    const list = map.get(cat);
    if (list) {
      list.push(p);
    } else {
      map.set(cat, [p]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const groups = Array.from(
    map, ([category, patterns]) => ({
      category,
      patterns,
    })
  );
  groups.sort((a, b) => {
    if (a.category === 'Other') return 1;
    if (b.category === 'Other') return -1;
    return a.category.localeCompare(b.category);
  });
  return groups;
}


/**
 * Rows in the chooser's pattern list: enough for about
 * PATTERN_LIST_COLUMNS columns. The list fills
 * top-to-bottom, then left-to-right, so pattern `i`
 * sits at row `i % rows`, column `floor(i / rows)`.
 */
export function patternListRowCount(
  patternCount: number
): number {
  return Math.ceil(patternCount / PATTERN_LIST_COLUMNS);
}

/**
 * Where the keyboard cursor is in the pattern chooser:
 * on a category key, or on a pattern in the list below.
 * `index` counts into the categories, or into the list
 * of the category that is showing.
 */
export type ChooserCursor =
  | { zone: 'category'; index: number }
  | { zone: 'pattern'; index: number };

/** Where a category key sits on screen (px). */
export interface KeyBox {
  top: number;
  left: number;
  width: number;
}

export interface ChooserLayout {
  categoryCount: number;
  /**
   * Category key positions, in category order. The keys
   * wrap onto several lines, and ↑ / ↓ move between
   * those lines. Without them, ↓ goes straight to the
   * list.
   */
  categoryBoxes?: KeyBox[];
  /** Patterns in the category that is showing. */
  patternCount: number;
  /** Index of the category that is showing, or -1. */
  shownCategoryIndex: number;
}

/**
 * The key on the next line of wrapped keys, above
 * (`direction` -1) or below (+1), whose center is
 * nearest horizontally. Null on the first / last line.
 */
export function keyOnAdjacentLine(
  boxes: KeyBox[],
  index: number,
  direction: 1 | -1,
): number | null {
  const from = boxes[index];
  if (!from) return null;
  // Keys on one line share a top; allow for sub-pixel
  // differences.
  const lineTops = [...new Set(boxes.map(b => Math.round(b.top)))]
    .sort((a, b) => a - b);
  const line = lineTops.indexOf(Math.round(from.top));
  const target = lineTops[line + direction];
  if (target === undefined) return null;
  const center = (b: KeyBox) => b.left + b.width / 2;
  let best: number | null = null;
  boxes.forEach((b, i) => {
    if (Math.round(b.top) !== target) return;
    if (
      best === null
      || Math.abs(center(b) - center(from))
        < Math.abs(center(boxes[best]) - center(from))
    ) {
      best = i;
    }
  });
  return best;
}

/** Step `index` by `delta` in 0..count-1, wrapping. */
function wrap(index: number, delta: number, count: number) {
  return (index + delta + count) % count;
}

/**
 * Move the chooser cursor for one key press. Returns
 * null when the key doesn't move it. On the category
 * keys, ← → move in order and wrap, and ↑ ↓ move between
 * their lines (↓ from the last line enters the list).
 * In the list, moves wrap around, except ↑ on the top
 * row, which goes up to the category keys.
 */
export function moveChooserCursor(
  cursor: ChooserCursor,
  key: string,
  layout: ChooserLayout,
): ChooserCursor | null {
  const {
    categoryCount, categoryBoxes, patternCount,
    shownCategoryIndex,
  } = layout;

  if (cursor.zone === 'category') {
    const at = (index: number): ChooserCursor =>
      ({ zone: 'category', index });
    switch (key) {
      case 'ArrowRight':
        return at(wrap(cursor.index, 1, categoryCount));
      case 'ArrowLeft':
        return at(wrap(cursor.index, -1, categoryCount));
      case 'Home':
        return at(0);
      case 'End':
        return at(categoryCount - 1);
      case 'ArrowUp': {
        const above = categoryBoxes
          ? keyOnAdjacentLine(categoryBoxes, cursor.index, -1)
          : null;
        return above === null ? null : at(above);
      }
      case 'ArrowDown': {
        // The next line of keys; from the last line,
        // into the pattern list.
        const below = categoryBoxes
          ? keyOnAdjacentLine(categoryBoxes, cursor.index, 1)
          : null;
        if (below !== null) return at(below);
        return patternCount > 0
          ? { zone: 'pattern', index: 0 }
          : null;
      }
      default:
        return null;
    }
  }

  if (patternCount === 0) return null;
  const rows = patternListRowCount(patternCount);
  const columns = Math.ceil(patternCount / rows);
  const row = cursor.index % rows;
  const column = Math.floor(cursor.index / rows);
  const at = (index: number): ChooserCursor =>
    ({ zone: 'pattern', index });
  // Same row in another column. The last column can be
  // shorter: then land on its last pattern.
  const inColumn = (col: number) =>
    at(Math.min(col * rows + row, patternCount - 1));

  switch (key) {
    case 'ArrowDown':
      return at(wrap(cursor.index, 1, patternCount));
    case 'ArrowUp':
      if (row > 0) return at(cursor.index - 1);
      return shownCategoryIndex >= 0
        ? { zone: 'category', index: shownCategoryIndex }
        : null;
    case 'ArrowRight':
      return inColumn(wrap(column, 1, columns));
    case 'ArrowLeft':
      return inColumn(wrap(column, -1, columns));
    case 'Home':
      return at(0);
    case 'End':
      return at(patternCount - 1);
    default:
      return null;
  }
}

/**
 * True when every track's steps are `base`'s steps cut
 * short or padded with empty steps: what changing only
 * the pattern length from `base` can produce. False
 * means something else edited the steps since.
 */
export function isResizeOf(
  tracks: Record<TrackId, TrackConfig>,
  base: Record<TrackId, TrackConfig>,
): boolean {
  return TRACK_IDS.every(id => {
    const a = tracks[id].steps;
    const b = base[id].steps;
    const n = Math.min(a.length, b.length);
    return a.slice(0, n) === b.slice(0, n)
      && !a.slice(n).includes('1');
  });
}

/**
 * Selected pattern ids
 *
 * The selected pattern id is a preset id, 'custom' (a
 * share link or a Reset grid, no preset), or a preset id
 * plus MODIFIED_MARK once its steps or levels have been
 * edited. Keeping the mark in the id means saving,
 * restoring and the Temp snapshot carry it for free, and
 * every pattern load clears it by setting a plain id.
 */
export const CUSTOM_PATTERN_ID = 'custom';
export const MODIFIED_MARK = '*';

/** The id with the edited mark added (once). */
export function markPatternModified(id: string): string {
  if (id === CUSTOM_PATTERN_ID) return id;
  if (id.endsWith(MODIFIED_MARK)) return id;
  return id + MODIFIED_MARK;
}

/** True if the selected preset was edited since it loaded. */
export function isPatternModified(id: string): boolean {
  return id !== CUSTOM_PATTERN_ID && id.endsWith(MODIFIED_MARK);
}

/** The preset id without the edited mark. */
export function basePatternId(id: string): string {
  return isPatternModified(id)
    ? id.slice(0, -MODIFIED_MARK.length)
    : id;
}
