import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  evaluateCondition,
} from '../app/trigConditions';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('evaluateCondition', () => {
  describe('undefined condition', () => {
    it('always fires when condition is undefined', () => {
      expect(evaluateCondition(undefined, { cycleCount: 0 })).toBe(true);
      expect(evaluateCondition(undefined, { cycleCount: 99 })).toBe(true);
    });
  });

  describe('probability condition', () => {
    it('fires when Math.random returns 0.49 with 50% probability', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.49);
      expect(
        evaluateCondition(
          { type: 'probability', value: 50 },
          { cycleCount: 0 }
        )
      ).toBe(true);
    });

    it('does not fire when Math.random returns 0.50 with 50% prob', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.50);
      expect(
        evaluateCondition(
          { type: 'probability', value: 50 },
          { cycleCount: 0 }
        )
      ).toBe(false);
    });

    it('fires when random < 0.01 with 1% probability', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.009);
      expect(
        evaluateCondition(
          { type: 'probability', value: 1 },
          { cycleCount: 0 }
        )
      ).toBe(true);
    });

    it('does not fire when random >= 0.99 with 99% probability', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      expect(
        evaluateCondition(
          { type: 'probability', value: 99 },
          { cycleCount: 0 }
        )
      ).toBe(false);
    });
  });

  describe('cycle condition', () => {
    it('cycle 1:4 fires on cycle 0', () => {
      expect(
        evaluateCondition(
          { type: 'cycle', a: 1, b: 4 },
          { cycleCount: 0 }
        )
      ).toBe(true);
    });

    it('cycle 1:4 does not fire on cycles 1, 2, 3', () => {
      const cond = { type: 'cycle' as const, a: 1, b: 4 };
      expect(evaluateCondition(cond, { cycleCount: 1 })).toBe(false);
      expect(evaluateCondition(cond, { cycleCount: 2 })).toBe(false);
      expect(evaluateCondition(cond, { cycleCount: 3 })).toBe(false);
    });

    it('cycle 3:4 fires on cycle 2', () => {
      expect(
        evaluateCondition(
          { type: 'cycle', a: 3, b: 4 },
          { cycleCount: 2 }
        )
      ).toBe(true);
    });

    it('cycle 2:2 fires on odd 0-indexed cycles', () => {
      const cond = { type: 'cycle' as const, a: 2, b: 2 };
      expect(evaluateCondition(cond, { cycleCount: 0 })).toBe(false);
      expect(evaluateCondition(cond, { cycleCount: 1 })).toBe(true);
      expect(evaluateCondition(cond, { cycleCount: 2 })).toBe(false);
      expect(evaluateCondition(cond, { cycleCount: 3 })).toBe(true);
    });
  });
});
