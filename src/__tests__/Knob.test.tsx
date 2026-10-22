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
});
