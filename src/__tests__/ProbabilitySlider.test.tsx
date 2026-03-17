import { render, screen, fireEvent }
  from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProbabilitySlider
  from '../app/ProbabilitySlider';

describe('ProbabilitySlider', () => {
  it('renders with aria-valuenow', () => {
    render(
      <ProbabilitySlider
        value={75}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole('slider')
        .getAttribute('aria-valuenow')
    ).toBe('75');
  });

  it('displays percentage text', () => {
    const { container } = render(
      <ProbabilitySlider
        value={42}
        onChange={vi.fn()}
      />
    );
    expect(container.textContent).toContain('42%');
  });

  it('ArrowRight +1', () => {
    const fn = vi.fn();
    render(
      <ProbabilitySlider value={50} onChange={fn} />
    );
    fireEvent.keyDown(
      screen.getByRole('slider'),
      { key: 'ArrowRight' }
    );
    expect(fn).toHaveBeenCalledWith(51);
  });

  it('Shift+ArrowRight +10', () => {
    const fn = vi.fn();
    render(
      <ProbabilitySlider value={50} onChange={fn} />
    );
    fireEvent.keyDown(
      screen.getByRole('slider'),
      { key: 'ArrowRight', shiftKey: true }
    );
    expect(fn).toHaveBeenCalledWith(60);
  });

  it('Home = 1', () => {
    const fn = vi.fn();
    render(
      <ProbabilitySlider value={50} onChange={fn} />
    );
    fireEvent.keyDown(
      screen.getByRole('slider'), { key: 'Home' }
    );
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('End = 100', () => {
    const fn = vi.fn();
    render(
      <ProbabilitySlider value={50} onChange={fn} />
    );
    fireEvent.keyDown(
      screen.getByRole('slider'), { key: 'End' }
    );
    expect(fn).toHaveBeenCalledWith(100);
  });

  it('clamps at 1 min', () => {
    const fn = vi.fn();
    render(
      <ProbabilitySlider value={1} onChange={fn} />
    );
    fireEvent.keyDown(
      screen.getByRole('slider'),
      { key: 'ArrowLeft' }
    );
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('clamps at 100 max', () => {
    const fn = vi.fn();
    render(
      <ProbabilitySlider value={100} onChange={fn} />
    );
    fireEvent.keyDown(
      screen.getByRole('slider'),
      { key: 'ArrowRight' }
    );
    expect(fn).toHaveBeenCalledWith(100);
  });
});
