import {
  fireEvent, render, screen,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProbabilityEditor from '../app/ProbabilityEditor';

describe('ProbabilityEditor', () => {
  it('renders a heading and a labelled slider', () => {
    render(<ProbabilityEditor value={60} onChange={vi.fn()} />);
    expect(screen.getByText('Probability'))
      .toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  it('keyboard input forwards new value to onChange', () => {
    const onChange = vi.fn();
    render(<ProbabilityEditor value={60} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), {
      key: 'ArrowRight',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeGreaterThan(60);
  });
});
