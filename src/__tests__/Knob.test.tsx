import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Knob from '../app/Knob';

describe('Knob', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
  });

  it('renders with correct aria attributes', () => {
    render(<Knob value={0.75} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '75');
  });

  it('ArrowUp increases value by 0.01', () => {
    const onChange = vi.fn();
    render(<Knob value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeCloseTo(0.51);
  });

  it('ArrowDown decreases value by 0.01', () => {
    const onChange = vi.fn();
    render(<Knob value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeCloseTo(0.49);
  });

  it('Shift+ArrowUp increases value by 0.1', () => {
    const onChange = vi.fn();
    render(<Knob value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, {
      key: 'ArrowUp',
      shiftKey: true,
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeCloseTo(0.6);
  });

  it('Home sets value to 0', () => {
    const onChange = vi.fn();
    render(<Knob value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('End sets value to 1', () => {
    const onChange = vi.fn();
    render(<Knob value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('clamps value at upper bound', () => {
    const onChange = vi.fn();
    render(<Knob value={0.995} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('clamps value at lower bound', () => {
    const onChange = vi.fn();
    render(<Knob value={0.005} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('renders custom formatValue in tooltip', () => {
    render(
      <Knob
        value={0.5}
        onChange={vi.fn()}
        formatValue={(v) => `${(v * 10).toFixed(1)} dB`}
      />
    );
    expect(screen.getByText('5.0 dB')).toBeDefined();
  });

  it('omits the hover value when showHoverValue is false', () => {
    render(
      <Knob
        value={0.5}
        onChange={vi.fn()}
        formatValue={(v) => `${(v * 10).toFixed(1)} dB`}
        showHoverValue={false}
      />
    );
    expect(screen.queryByText('5.0 dB')).toBeNull();
    // The value stays available to screen readers.
    expect(
      screen.getByRole('slider').getAttribute('aria-valuetext')
    ).toBe('5.0 dB');
  });

  it('double-click resets to defaultValue', () => {
    const onChange = vi.fn();
    render(
      <Knob
        value={0.3}
        onChange={onChange}
        defaultValue={0.8}
      />
    );
    const slider = screen.getByRole('slider');
    fireEvent.click(slider, { detail: 2 });
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it('describes keyboard controls via aria-describedby', () => {
    render(<Knob value={0.5} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAccessibleDescription(
      /arrow keys to adjust/i
    );
    expect(slider).not.toHaveAccessibleDescription(
      /double-click/i
    );
  });

  it('mentions reset when a default value exists', () => {
    render(
      <Knob value={0.5} onChange={vi.fn()} defaultValue={0.5} />
    );
    expect(
      screen.getByRole('slider')
    ).toHaveAccessibleDescription(/double-click to reset/i);
  });

  it('keeps an outer aria-describedby id', () => {
    render(
      <>
        <span id="outer">Outer hint</span>
        <Knob
          value={0.5}
          onChange={vi.fn()}
          aria-describedby="outer"
        />
      </>
    );
    expect(
      screen.getByRole('slider')
    ).toHaveAccessibleDescription(/arrow keys.*Outer hint/i);
  });

  it('exposes the formatted value as aria-valuetext', () => {
    render(
      <Knob
        value={0.25}
        onChange={vi.fn()}
        formatValue={v => `L${Math.round(v * 100)}`}
      />
    );
    expect(
      screen.getByRole('slider')
    ).toHaveAttribute('aria-valuetext', 'L25');
  });

  describe('with steps', () => {
    it('arrow keys move one position', () => {
      const onChange = vi.fn();
      render(<Knob value={0.5} onChange={onChange} steps={5} />);
      const slider = screen.getByRole('slider');
      fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });
      expect(onChange.mock.calls[0][0]).toBeCloseTo(0.75);
      fireEvent.keyDown(slider, { key: 'ArrowDown' });
      expect(onChange.mock.calls[1][0]).toBeCloseTo(0.25);
    });

    it('drags snap to the nearest position', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <Knob value={0} onChange={onChange} steps={5} />
      );
      const slider = screen.getByRole('slider');
      fireEvent.pointerDown(slider, { clientY: 100, pointerId: 1 });
      // 60 px up = +0.3, which snaps to 0.25
      fireEvent.pointerMove(slider, { clientY: 40, pointerId: 1 });
      expect(onChange).toHaveBeenLastCalledWith(0.25);
      rerender(<Knob value={0.25} onChange={onChange} steps={5} />);
      // A move that stays on the same position sends nothing
      fireEvent.pointerMove(slider, { clientY: 38, pointerId: 1 });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
