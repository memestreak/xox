import { describe, expect, it } from 'vitest';
import { getStepColor } from '../app/stepColors';

describe('getStepColor', () => {
  it('active + current (full size) glows and scales', () => {
    const c = getStepColor(true, true);
    expect(c).toContain('bg-orange-400');
    expect(c).toContain('motion-safe:scale-105');
    expect(c).toContain('shadow-');
  });

  it('active + current (mini) is plain bright orange', () => {
    expect(getStepColor(true, true, true))
      .toBe('bg-orange-400');
  });

  it('active, not current, is orange-600 at any size', () => {
    expect(getStepColor(true, false)).toBe('bg-orange-600');
    expect(getStepColor(true, false, true))
      .toBe('bg-orange-600');
  });

  it('inactive + current is the playhead grey', () => {
    expect(getStepColor(false, true)).toBe('bg-neutral-700');
    expect(getStepColor(false, true, true))
      .toBe('bg-neutral-700');
  });

  it('inactive, not current, has a hover state', () => {
    const c = getStepColor(false, false);
    expect(c).toContain('bg-neutral-800/40');
    expect(c).toContain('hover:bg-neutral-800');
  });
});
