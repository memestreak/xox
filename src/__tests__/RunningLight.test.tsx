import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RunningLight from '../app/RunningLight';

describe('RunningLight with pageOffset', () => {
  it('highlights dot matching global step', () => {
    const { container } = render(
      <RunningLight
        currentStep={18}
        patternLength={32}
        pageOffset={16}
      />
    );
    const dots = container.querySelectorAll(
      '.rounded-full'
    );
    // Step 18 is local index 2 on page 2
    expect(
      dots[2].className
    ).toContain('bg-orange');
    expect(
      dots[0].className
    ).not.toContain('bg-orange');
  });

  it('dims dots beyond patternLength', () => {
    const { container } = render(
      <RunningLight
        currentStep={-1}
        patternLength={24}
        pageOffset={16}
      />
    );
    const dots = container.querySelectorAll(
      '.rounded-full'
    );
    // Steps 17-24 active (indices 0-7), 25-32 dimmed (8-15)
    expect(
      dots[7].className
    ).toContain('bg-neutral');
    expect(
      dots[8].className
    ).toContain('bg-transparent');
  });

  it('no highlight when step is on another page', () => {
    const { container } = render(
      <RunningLight
        currentStep={5}
        patternLength={32}
        pageOffset={16}
      />
    );
    const dots = container.querySelectorAll(
      '.rounded-full'
    );
    for (let i = 0; i < 16; i++) {
      expect(
        dots[i].className
      ).not.toContain('bg-orange');
    }
  });
});
