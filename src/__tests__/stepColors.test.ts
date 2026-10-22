import { describe, expect, it } from 'vitest';
import {
  getStepColor, PLAYHEAD_CLASS, stepGroup,
} from '../app/stepColors';

describe('stepGroup', () => {
  it('groups steps in fours within each 16-step page', () => {
    expect(stepGroup(0)).toBe(0);
    expect(stepGroup(3)).toBe(0);
    expect(stepGroup(4)).toBe(1);
    expect(stepGroup(11)).toBe(2);
    expect(stepGroup(15)).toBe(3);
    expect(stepGroup(16)).toBe(0);
    expect(stepGroup(21)).toBe(1);
  });
});

describe('getStepColor', () => {
  it('lit keys use their group color', () => {
    expect(getStepColor(true, false, false, 0))
      .toContain('bg-step1 ');
    expect(getStepColor(true, false, false, 3))
      .toContain('bg-step4 ');
  });

  it('unlit keys use the dim group color', () => {
    expect(getStepColor(false, false, false, 1))
      .toContain('bg-step2-off');
  });

  it('marks the playing step, lit or not', () => {
    expect(getStepColor(true, true, false, 0))
      .toContain(PLAYHEAD_CLASS);
    expect(getStepColor(false, true, false, 0))
      .toContain(PLAYHEAD_CLASS);
    expect(getStepColor(true, false, false, 0))
      .not.toContain(PLAYHEAD_CLASS);
  });

  it('lit playing step is brightened', () => {
    expect(getStepColor(true, true)).toContain('brightness-125');
  });

  it('unlit keys have a hover state', () => {
    expect(getStepColor(false, false))
      .toContain('hover:brightness-125');
  });

  it('accent (mini) keys use the accent color', () => {
    expect(getStepColor(true, false, true)).toBe('bg-accent');
    expect(getStepColor(true, true, true))
      .toBe('bg-accent-hi');
    expect(getStepColor(false, true, true)).toBe('bg-faint');
    expect(getStepColor(false, false, true))
      .toBe('bg-[#2a2824]');
  });
});
