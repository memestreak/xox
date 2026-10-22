import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CycleBadge,
  FillBadge,
  PanIndicator,
  ProbabilityBar,
} from '../app/StepBadges';

describe('ProbabilityBar', () => {
  it('width matches the probability percent', () => {
    render(<ProbabilityBar probability={37} />);
    expect(screen.getByTestId('prob-bar').style.width)
      .toBe('37%');
  });
});

describe('PanIndicator', () => {
  it('center pan renders a 2px centered tick', () => {
    render(<PanIndicator panLock={0.5} />);
    const bar = screen.getByTestId('pan-bar');
    expect(bar.style.left).toBe('50%');
    expect(bar.style.width).toBe('2px');
  });

  it('left pan grows leftward from center', () => {
    render(<PanIndicator panLock={0.25} />);
    const bar = screen.getByTestId('pan-bar');
    expect(bar.style.right).toBe('50%');
    expect(bar.style.width).toBe('25%');
    expect(bar.style.left).toBe('');
  });

  it('right pan grows rightward from center', () => {
    render(<PanIndicator panLock={1} />);
    const bar = screen.getByTestId('pan-bar');
    expect(bar.style.left).toBe('50%');
    expect(bar.style.width).toBe('50%');
    expect(bar.style.right).toBe('');
  });
});

describe('FillBadge', () => {
  it('shows F for fill', () => {
    render(<FillBadge fill="fill" />);
    expect(screen.getByTestId('fill-badge'))
      .toHaveTextContent(/^F$/);
  });

  it('shows !F for not-fill', () => {
    render(<FillBadge fill="!fill" />);
    expect(screen.getByTestId('fill-badge'))
      .toHaveTextContent(/^!F$/);
  });
});

describe('CycleBadge', () => {
  it('renders a:b', () => {
    const { container } = render(<CycleBadge a={3} b={4} />);
    expect(container.textContent).toBe('3:4');
  });
});
