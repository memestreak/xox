import { describe, expect, it } from 'vitest';
import patternsData from '../app/data/patterns.json';
import {
  getCategorizedPatterns,
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
      { id: 'x', name: 'X', steps: {} },
    ] as Pattern[];
    const groups = getCategorizedPatterns(noCategory);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('Other');
  });

  it('has expected categories', () => {
    const categories = result.map(g => g.category);
    expect(categories).toContain('Funk');
    expect(categories).toContain('Rock');
    expect(categories).toContain('Disco');
    expect(categories).toContain('Other');
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

  it('Other is the last category', () => {
    const categories = result.map(g => g.category);
    expect(categories[categories.length - 1]).toBe(
      'Other'
    );
  });

  it('accounts for all 137 patterns', () => {
    const total = result.reduce(
      (sum, g) => sum + g.patterns.length, 0
    );
    expect(total).toBe(137);
  });
});
