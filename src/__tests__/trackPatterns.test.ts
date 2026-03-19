import { describe, expect, it } from 'vitest';
import data from '../app/data/trackPatterns.json';
import type { TrackPattern } from '../app/types';

const patterns: TrackPattern[] = data.patterns;

describe('trackPatterns.json', () => {
  it('has at least one pattern', () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('every pattern has a 16-char binary steps string',
    () => {
      for (const p of patterns) {
        expect(p.steps).toMatch(/^[01]{16}$/);
      }
    }
  );

  it('every pattern has a unique id', () => {
    const ids = patterns.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pattern has a non-empty name', () => {
    for (const p of patterns) {
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('patterns are ordered by density '
    + '(non-decreasing note count)', () => {
      const counts = patterns.map(
        p => p.steps.split('')
          .filter(c => c === '1').length
      );
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(
          counts[i - 1]
        );
      }
    }
  );
});
