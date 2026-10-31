import { describe, expect, it } from 'vitest';
import {
  RETRIG_LENGTHS,
  RETRIG_RATES,
  retrigCoverage,
  retrigHits,
} from '../app/retrig';

const on = (rate: number, length: number) => (
  { enabled: true, rate, length }
);
const EMPTY = '1000000000000000';

describe('retrigHits', () => {
  it('plays the step once without an enabled retrig', () => {
    expect(retrigHits(EMPTY, 0, undefined, 16)).toEqual([0]);
    expect(retrigHits(
      EMPTY, 0, { enabled: false, rate: 32, length: 4 }, 16,
    )).toEqual([0]);
  });

  it('plays a flam inside one step', () => {
    // 1/64 for a 1/32: two hits a quarter step apart
    expect(retrigHits(EMPTY, 0, on(64, 0.5), 16))
      .toEqual([0, 0.25]);
  });

  it('rolls over several steps', () => {
    // 1/32 for a 1/4: 8 hits over 4 steps
    expect(retrigHits(EMPTY, 0, on(32, 4), 16))
      .toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  });

  it('plays rates slower than a step', () => {
    // 1/8 for a 1/2: a hit every other step
    expect(retrigHits(EMPTY, 0, on(8, 8), 16))
      .toEqual([0, 2, 4, 6]);
  });

  it('handles triplet and fives rates', () => {
    const hits = retrigHits(EMPTY, 0, on(24, 2), 16);
    expect(hits).toHaveLength(3);
    expect(hits[2]).toBeCloseTo(4 / 3);
    // A 1/5 note is 3.2 steps
    expect(retrigHits(EMPTY, 0, on(5, 4), 16)).toEqual([0, 3.2]);
    expect(retrigHits(EMPTY, 0, on(5, 3), 16)).toEqual([0]);
  });

  it('stops at the next lit step', () => {
    const steps = '1001000000000000';
    expect(retrigHits(steps, 0, on(16, 8), 16))
      .toEqual([0, 1, 2]);
  });

  it('stops at the pattern end', () => {
    // Step 14 of 16: two steps left
    expect(retrigHits(EMPTY, 14, on(16, 8), 2))
      .toEqual([0, 1]);
  });

  it('sees the next lit step past the track end', () => {
    // 4-step track in a longer pattern: step 3 wraps to 0
    expect(retrigHits('1001', 3, on(16, 4), 13))
      .toEqual([0]);
  });
});

describe('retrigCoverage', () => {
  it('counts the hits each step gets', () => {
    const cover = retrigCoverage(
      '0010000000000000',
      { 2: { retrig: on(64, 4) } },
      16,
    );
    expect([...cover]).toEqual([[2, 4], [3, 4], [4, 4], [5, 4]]);
  });

  it('skips unlit steps and retrigs that are off', () => {
    const cover = retrigCoverage(
      '1000000000000000',
      {
        0: { retrig: { enabled: false, rate: 32, length: 4 } },
        5: { retrig: on(32, 4) },
      },
      16,
    );
    expect(cover.size).toBe(0);
  });
});

describe('option lists', () => {
  it('offer the agreed rates', () => {
    expect(RETRIG_RATES).toEqual(
      [5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80],
    );
  });

  it('start under a step and end at a bar', () => {
    expect(RETRIG_LENGTHS[0]).toEqual([0.125, '1/128']);
    expect(RETRIG_LENGTHS.at(-1)).toEqual([16, '1/1']);
  });
});
