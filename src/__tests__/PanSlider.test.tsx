import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PanSlider from '../app/PanSlider';

describe('PanSlider', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
  });

  it('renders with correct aria attributes', () => {
    render(<PanSlider value={50} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-label', 'Pan');
  });

  it('displays "C" when value is 50', () => {
    render(<PanSlider value={50} onChange={vi.fn()} />);
    expect(screen.getByText('C')).toBeDefined();
  });

  it('displays "L50" when value is 25', () => {
    render(<PanSlider value={25} onChange={vi.fn()} />);
    expect(screen.getByText('L50')).toBeDefined();
  });

  it('displays "R50" when value is 75', () => {
    render(<PanSlider value={75} onChange={vi.fn()} />);
    expect(screen.getByText('R50')).toBeDefined();
  });

  it('ArrowRight increases value', () => {
    const onChange = vi.fn();
    render(<PanSlider value={50} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(51);
  });

  it('ArrowLeft decreases value', () => {
    const onChange = vi.fn();
    render(<PanSlider value={50} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(49);
  });

  it('Shift+ArrowRight increases by 10', () => {
    const onChange = vi.fn();
    render(<PanSlider value={50} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('Home sets to 0, End sets to 100', () => {
    const onChange = vi.fn();
    render(<PanSlider value={50} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(100);
  });
});
