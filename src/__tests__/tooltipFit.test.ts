import { describe, it, expect } from 'vitest';
import { tooltipShift } from '../app/tooltipFit';

const band = { left: 100, right: 500 };

describe('tooltipShift', () => {
  it('leaves a tooltip that fits alone', () => {
    expect(
      tooltipShift({ left: 200, right: 300 }, band, 4)
    ).toBe(0);
  });

  it('moves a tooltip right past the left edge', () => {
    expect(
      tooltipShift({ left: 50, right: 150 }, band, 4)
    ).toBe(54);
  });

  it('moves a tooltip left past the right edge', () => {
    expect(
      tooltipShift({ left: 450, right: 550 }, band, 4)
    ).toBe(-54);
  });

  it('lines a too-wide tooltip up with the left edge', () => {
    expect(
      tooltipShift({ left: 300, right: 800 }, band, 4)
    ).toBe(-196);
  });
});
