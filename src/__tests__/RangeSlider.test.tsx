import { render, screen, fireEvent } from
  '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RangeSlider from '../app/RangeSlider';

describe('RangeSlider', () => {
  it('renders with current value', () => {
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('clamps at min on Home key', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('clamps at max on End key', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('respects custom min (e.g., 1 for probability)',
    () => {
      const onChange = vi.fn();
      render(
        <RangeSlider
          value={5} min={1} max={100}
          onChange={onChange}
        />
      );
      const slider = screen.getByRole('slider');
      fireEvent.keyDown(slider, { key: 'Home' });
      expect(onChange).toHaveBeenCalledWith(1);
    }
  );

  it('arrow key increments by 1', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(
      slider, { key: 'ArrowRight' }
    );
    expect(onChange).toHaveBeenCalledWith(51);
  });

  it('shift+arrow increments by 10', () => {
    const onChange = vi.fn();
    render(
      <RangeSlider
        value={50} min={0} max={100}
        onChange={onChange}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(
      slider,
      { key: 'ArrowRight', shiftKey: true }
    );
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('sets correct aria attributes', () => {
    render(
      <RangeSlider
        value={42} min={0} max={100}
        onChange={vi.fn()} label="Gain"
      />
    );
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin'))
      .toBe('0');
    expect(slider.getAttribute('aria-valuemax'))
      .toBe('100');
    expect(slider.getAttribute('aria-valuenow'))
      .toBe('42');
    expect(slider.getAttribute('aria-label'))
      .toBe('Gain');
  });
});
