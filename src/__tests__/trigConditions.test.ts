import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  evaluateCondition,
  CYCLE_OPTIONS,
} from '../app/trigConditions';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('evaluateCondition', () => {
  describe('undefined condition', () => {
    it('always fires when condition is undefined',
      () => {
        expect(evaluateCondition(
          undefined, { cycleCount: 0, fillActive: false }
        )).toBe(true);
        expect(evaluateCondition(
          undefined, { cycleCount: 99, fillActive: false }
        )).toBe(true);
      }
    );
  });

  describe('probability condition', () => {
    it('fires when random < probability/100',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.49);
        expect(evaluateCondition(
          { probability: 50 }, { cycleCount: 0, fillActive: false }
        )).toBe(true);
      }
    );

    it('does not fire when random >= prob/100',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.50);
        expect(evaluateCondition(
          { probability: 50 }, { cycleCount: 0, fillActive: false }
        )).toBe(false);
      }
    );

    it('fires when random < 0.01 with 1% prob',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.009);
        expect(evaluateCondition(
          { probability: 1 }, { cycleCount: 0, fillActive: false }
        )).toBe(true);
      }
    );

    it('does not fire when random >= 0.99 with 99%',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.99);
        expect(evaluateCondition(
          { probability: 99 }, { cycleCount: 0, fillActive: false }
        )).toBe(false);
      }
    );
  });

  describe('cycle condition', () => {
    it('cycle 1:4 fires on cycle 0', () => {
      expect(evaluateCondition(
        { cycle: { a: 1, b: 4 } },
        { cycleCount: 0, fillActive: false }
      )).toBe(true);
    });

    it('cycle 1:4 does not fire on 1, 2, 3',
      () => {
        const cond = { cycle: { a: 1, b: 4 } };
        expect(evaluateCondition(
          cond, { cycleCount: 1, fillActive: false }
        )).toBe(false);
        expect(evaluateCondition(
          cond, { cycleCount: 2, fillActive: false }
        )).toBe(false);
        expect(evaluateCondition(
          cond, { cycleCount: 3, fillActive: false }
        )).toBe(false);
      }
    );

    it('cycle 3:4 fires on cycle 2', () => {
      expect(evaluateCondition(
        { cycle: { a: 3, b: 4 } },
        { cycleCount: 2, fillActive: false }
      )).toBe(true);
    });

    it('cycle 2:2 fires on odd 0-indexed cycles',
      () => {
        const cond = { cycle: { a: 2, b: 2 } };
        expect(evaluateCondition(
          cond, { cycleCount: 0, fillActive: false }
        )).toBe(false);
        expect(evaluateCondition(
          cond, { cycleCount: 1, fillActive: false }
        )).toBe(true);
        expect(evaluateCondition(
          cond, { cycleCount: 2, fillActive: false }
        )).toBe(false);
        expect(evaluateCondition(
          cond, { cycleCount: 3, fillActive: false }
        )).toBe(true);
      }
    );
  });

  describe('fill condition', () => {
    it('FILL fires when fillActive=true', () => {
      expect(evaluateCondition(
        { fill: 'fill' },
        { cycleCount: 0, fillActive: true }
      )).toBe(true);
    });

    it('FILL suppressed when fillActive=false',
      () => {
        expect(evaluateCondition(
          { fill: 'fill' },
          { cycleCount: 0, fillActive: false }
        )).toBe(false);
      }
    );

    it('!FILL fires when fillActive=false', () => {
      expect(evaluateCondition(
        { fill: '!fill' },
        { cycleCount: 0, fillActive: false }
      )).toBe(true);
    });

    it('!FILL suppressed when fillActive=true',
      () => {
        expect(evaluateCondition(
          { fill: '!fill' },
          { cycleCount: 0, fillActive: true }
        )).toBe(false);
      }
    );

    it('undefined fill has no effect', () => {
      expect(evaluateCondition(
        {}, { cycleCount: 0, fillActive: true }
      )).toBe(true);
      expect(evaluateCondition(
        {}, { cycleCount: 0, fillActive: false }
      )).toBe(true);
    });
  });

  describe('AND semantics', () => {
    it('both must pass for step to fire', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValue(0.49);
      // prob passes (50% > 49%), cycle 1:2 on
      // cycle 0 => (0%2)+1=1 === a=1 => true
      expect(evaluateCondition(
        { probability: 50, cycle: { a: 1, b: 2 } },
        { cycleCount: 0, fillActive: false }
      )).toBe(true);
    });

    it('prob passes but cycle fails => false',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.01);
        // cycle 1:2 on cycle 1: (1%2)+1=2 !== 1
        expect(evaluateCondition(
          {
            probability: 50,
            cycle: { a: 1, b: 2 },
          },
          { cycleCount: 1, fillActive: false }
        )).toBe(false);
      }
    );

    it('cycle passes but prob fails => false',
      () => {
        vi.spyOn(Math, 'random')
          .mockReturnValue(0.99);
        expect(evaluateCondition(
          {
            probability: 50,
            cycle: { a: 1, b: 2 },
          },
          { cycleCount: 0, fillActive: false }
        )).toBe(false);
      }
    );

    it('fill + probability: both must pass', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValue(0.49);
      expect(evaluateCondition(
        { fill: 'fill', probability: 50 },
        { cycleCount: 0, fillActive: true }
      )).toBe(true);
      expect(evaluateCondition(
        { fill: 'fill', probability: 50 },
        { cycleCount: 0, fillActive: false }
      )).toBe(false);
    });

    it('fill + cycle: both must pass', () => {
      expect(evaluateCondition(
        { fill: 'fill', cycle: { a: 1, b: 2 } },
        { cycleCount: 0, fillActive: true }
      )).toBe(true);
      expect(evaluateCondition(
        { fill: 'fill', cycle: { a: 1, b: 2 } },
        { cycleCount: 0, fillActive: false }
      )).toBe(false);
    });
  });
});

describe('CYCLE_OPTIONS', () => {
  it('starts with 1:1', () => {
    expect(CYCLE_OPTIONS[0]).toEqual(
      { label: '1:1', a: 1, b: 1 }
    );
  });

  it('contains all a:b for b 2-8', () => {
    // Total: 1 + sum(2..8) = 1 + 2+3+4+5+6+7+8
    //      = 1 + 35 = 36
    expect(CYCLE_OPTIONS).toHaveLength(36);
  });

  it('last option is 8:8', () => {
    const last =
      CYCLE_OPTIONS[CYCLE_OPTIONS.length - 1];
    expect(last).toEqual(
      { label: '8:8', a: 8, b: 8 }
    );
  });

  it('labels match a:b format', () => {
    for (const opt of CYCLE_OPTIONS) {
      expect(opt.label).toBe(`${opt.a}:${opt.b}`);
    }
  });
});
