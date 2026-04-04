import { describe, it, expect } from 'vitest';
import {
  computeEffectiveStep,
  formatPan,
} from '../app/trackUtils';

describe('computeEffectiveStep', () => {
  it('returns -1 when currentStep < 0', () => {
    expect(computeEffectiveStep(-1, 0, false, 16))
      .toBe(-1);
  });

  it('uses currentStep when not free-run', () => {
    expect(computeEffectiveStep(5, 100, false, 16))
      .toBe(5);
  });

  it('wraps currentStep by trackLength', () => {
    expect(computeEffectiveStep(20, 100, false, 16))
      .toBe(4);
  });

  it('uses totalSteps when free-run', () => {
    expect(computeEffectiveStep(5, 100, true, 16))
      .toBe(4); // 100 % 16 = 4
  });

  it('handles short tracks', () => {
    expect(computeEffectiveStep(7, 0, false, 4))
      .toBe(3); // 7 % 4 = 3
  });
});

describe('formatPan', () => {
  it('center returns "C"', () => {
    expect(formatPan(0.5)).toBe('C');
  });

  it('full left returns "L100"', () => {
    expect(formatPan(0)).toBe('L100');
  });

  it('full right returns "R100"', () => {
    expect(formatPan(1)).toBe('R100');
  });

  it('quarter left returns "L50"', () => {
    expect(formatPan(0.25)).toBe('L50');
  });

  it('quarter right returns "R50"', () => {
    expect(formatPan(0.75)).toBe('R50');
  });
});
