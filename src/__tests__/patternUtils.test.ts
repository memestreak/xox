import { describe, expect, it } from 'vitest';
import patternsData from '../app/data/patterns.json';
import {
  getCategorizedPatterns,
  keyOnAdjacentLine,
  moveChooserCursor,
  patternListRowCount,
} from '../app/patternUtils';
import type { Pattern } from '../app/types';

const patterns = patternsData.patterns as Pattern[];

describe('getCategorizedPatterns', () => {
  const result = getCategorizedPatterns(patterns);

  it('returns non-empty groups', () => {
    expect(result.length).toBeGreaterThan(0);
    for (const group of result) {
      expect(group.patterns.length).toBeGreaterThan(0);
    }
  });

  it('every pattern appears exactly once', () => {
    const ids = result.flatMap(
      g => g.patterns.map(p => p.id)
    );
    expect(ids).toHaveLength(patterns.length);
    expect(new Set(ids).size).toBe(patterns.length);
  });

  it('sorts patterns by name within categories', () => {
    for (const group of result) {
      const names = group.patterns.map(p => p.name);
      const sorted = [...names].sort((a, b) =>
        a.localeCompare(b)
      );
      expect(names).toEqual(sorted);
    }
  });

  it('handles empty input', () => {
    expect(getCategorizedPatterns([])).toEqual([]);
  });

  it('falls back to Other for missing category', () => {
    const noCategory = [
      { id: 'x', name: 'X', tracks: {} },
    ] as Pattern[];
    const groups = getCategorizedPatterns(noCategory);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('Other');
  });

  it('has expected categories', () => {
    const categories = result.map(g => g.category);
    expect(categories).toContain('House');
    expect(categories).toContain('Rock');
    expect(categories).toContain('Trap');
    expect(categories).toContain('Afrobeat');
  });

  it('categories are sorted alphabetically', () => {
    const categories = result.map(g => g.category);
    const withoutOther = categories.filter(
      c => c !== 'Other'
    );
    const sorted = [...withoutOther].sort(
      (a, b) => a.localeCompare(b)
    );
    expect(withoutOther).toEqual(sorted);
  });

  it('last category is alphabetically last', () => {
    const categories = result.map(g => g.category);
    const sorted = [...categories].sort(
      (a, b) => a.localeCompare(b)
    );
    expect(categories[categories.length - 1]).toBe(
      sorted[sorted.length - 1]
    );
  });

  it('accounts for all 142 patterns', () => {
    const total = result.reduce(
      (sum, g) => sum + g.patterns.length, 0
    );
    expect(total).toBe(142);
  });
});

describe('patternListRowCount', () => {
  it.each([
    [0, 0], [1, 1], [4, 1], [5, 2], [8, 2], [9, 3],
  ])('%i patterns -> %i rows', (count, rows) => {
    expect(patternListRowCount(count)).toBe(rows);
  });
});

describe('moveChooserCursor', () => {
  // 3 categories, showing #1, whose list has 7 patterns
  // in 2 rows:  0 2 4 6
  //             1 3 5
  const layout = {
    categoryCount: 3,
    patternCount: 7,
    shownCategoryIndex: 1,
  };
  const cat = (index: number) =>
    ({ zone: 'category' as const, index });
  const pat = (index: number) =>
    ({ zone: 'pattern' as const, index });

  describe('on the category keys', () => {
    it('moves right and left, wrapping', () => {
      expect(moveChooserCursor(cat(0), 'ArrowRight', layout))
        .toEqual(cat(1));
      expect(moveChooserCursor(cat(2), 'ArrowRight', layout))
        .toEqual(cat(0));
      expect(moveChooserCursor(cat(0), 'ArrowLeft', layout))
        .toEqual(cat(2));
    });

    it('jumps with Home and End', () => {
      expect(moveChooserCursor(cat(1), 'Home', layout))
        .toEqual(cat(0));
      expect(moveChooserCursor(cat(1), 'End', layout))
        .toEqual(cat(2));
    });

    it('goes down into the list', () => {
      expect(moveChooserCursor(cat(1), 'ArrowDown', layout))
        .toEqual(pat(0));
    });

    it('does not go down into an empty list', () => {
      expect(moveChooserCursor(
        cat(1), 'ArrowDown', { ...layout, patternCount: 0 },
      )).toBeNull();
    });

    it('ignores up and other keys', () => {
      expect(moveChooserCursor(cat(1), 'ArrowUp', layout))
        .toBeNull();
      expect(moveChooserCursor(cat(1), 'a', layout))
        .toBeNull();
    });
  });

  describe('in the pattern list', () => {
    it('steps down in list order and wraps at the end', () => {
      expect(moveChooserCursor(pat(0), 'ArrowDown', layout))
        .toEqual(pat(1));
      // Bottom of a column -> top of the next
      expect(moveChooserCursor(pat(1), 'ArrowDown', layout))
        .toEqual(pat(2));
      expect(moveChooserCursor(pat(6), 'ArrowDown', layout))
        .toEqual(pat(0));
    });

    it('steps up within a column', () => {
      expect(moveChooserCursor(pat(3), 'ArrowUp', layout))
        .toEqual(pat(2));
    });

    it('goes up from the top row to the shown category', () => {
      expect(moveChooserCursor(pat(0), 'ArrowUp', layout))
        .toEqual(cat(1));
      expect(moveChooserCursor(pat(4), 'ArrowUp', layout))
        .toEqual(cat(1));
    });

    it('moves a column right and left on the same row', () => {
      expect(moveChooserCursor(pat(1), 'ArrowRight', layout))
        .toEqual(pat(3));
      expect(moveChooserCursor(pat(3), 'ArrowLeft', layout))
        .toEqual(pat(1));
    });

    it('wraps columns on the same row', () => {
      expect(moveChooserCursor(pat(6), 'ArrowRight', layout))
        .toEqual(pat(0));
      expect(moveChooserCursor(pat(0), 'ArrowLeft', layout))
        .toEqual(pat(6));
    });

    it('lands on the last pattern of a shorter column', () => {
      // Row 2 of column 4 doesn't exist: land on 6.
      expect(moveChooserCursor(pat(5), 'ArrowRight', layout))
        .toEqual(pat(6));
      expect(moveChooserCursor(pat(1), 'ArrowLeft', layout))
        .toEqual(pat(6));
    });

    it('jumps with Home and End', () => {
      expect(moveChooserCursor(pat(3), 'Home', layout))
        .toEqual(pat(0));
      expect(moveChooserCursor(pat(3), 'End', layout))
        .toEqual(pat(6));
    });
  });
});

describe('category keys on wrapped lines', () => {
  // Line 1: keys 0 1 2 (centers 50, 150, 250)
  // Line 2: keys 3 4   (centers 40, 170)
  const boxes = [
    { top: 0, left: 0, width: 100 },
    { top: 0, left: 100, width: 100 },
    { top: 0, left: 200, width: 100 },
    { top: 40.4, left: 0, width: 80 },
    { top: 40, left: 120, width: 100 },
  ];
  const layout = {
    categoryCount: 5,
    categoryBoxes: boxes,
    patternCount: 3,
    shownCategoryIndex: 0,
  };
  const cat = (index: number) =>
    ({ zone: 'category' as const, index });

  it('finds the nearest key on the line below or above', () => {
    expect(keyOnAdjacentLine(boxes, 0, 1)).toBe(3);
    expect(keyOnAdjacentLine(boxes, 2, 1)).toBe(4);
    expect(keyOnAdjacentLine(boxes, 4, -1)).toBe(1);
  });

  it('has no line above the first or below the last', () => {
    expect(keyOnAdjacentLine(boxes, 1, -1)).toBeNull();
    expect(keyOnAdjacentLine(boxes, 3, 1)).toBeNull();
  });

  it('moves down a line, then into the list', () => {
    expect(moveChooserCursor(cat(2), 'ArrowDown', layout))
      .toEqual(cat(4));
    expect(moveChooserCursor(cat(4), 'ArrowDown', layout))
      .toEqual({ zone: 'pattern', index: 0 });
  });

  it('moves up a line and stops on the first', () => {
    expect(moveChooserCursor(cat(3), 'ArrowUp', layout))
      .toEqual(cat(0));
    expect(moveChooserCursor(cat(0), 'ArrowUp', layout))
      .toBeNull();
  });
});
