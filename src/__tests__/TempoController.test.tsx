import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import TempoController from '../app/TempoController';

describe('TempoController', () => {
  it('renders current BPM value', () => {
    render(
      <TempoController bpm={120} setBpm={vi.fn()} />
    );
    const input = screen.getByLabelText(/bpm/i);
    expect(input).toHaveValue(120);
  });

  it('calls setBpm with numeric value on change', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '150' } });
    expect(setBpm).toHaveBeenCalledWith(150);
  });

  it('clamps below-minimum to 20', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '5' } });
    expect(setBpm).toHaveBeenCalledWith(20);
  });

  it('clamps above-maximum to 300', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '999' } });
    expect(setBpm).toHaveBeenCalledWith(300);
  });

  it('non-numeric input defaults to 20', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const input = screen.getByLabelText(/bpm/i);
    fireEvent.change(input, { target: { value: '' } });
    expect(setBpm).toHaveBeenCalledWith(20);
  });
});

describe('TempoController tap tempo', () => {
  let perfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    perfSpy = vi.spyOn(performance, 'now');
  });

  afterEach(() => {
    perfSpy.mockRestore();
  });

  it('renders TAP button with correct aria-label', () => {
    render(
      <TempoController bpm={120} setBpm={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: 'Tap tempo' })
    ).toBeInTheDocument();
  });

  it('single tap does not call setBpm', () => {
    const setBpm = vi.fn();
    perfSpy.mockReturnValueOnce(1000);
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Tap tempo' })
    );
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('2 taps at 500ms apart sets BPM to 120', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1500);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(120);
  });

  it('4 taps compute average of all intervals', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    // 400ms, 500ms, 600ms intervals -> avg 500ms -> 120 BPM
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1400)
      .mockReturnValueOnce(1900)
      .mockReturnValueOnce(2500);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenLastCalledWith(120);
  });

  it('BPM rounded to nearest 0.5', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    // 470ms interval -> 60000/470 = 127.6595... -> 127.5
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1470);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(127.5);
  });

  it('buffer resets after >2000ms gap', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1500)
      // Third tap after 2s gap — buffer resets
      .mockReturnValueOnce(4000);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(120);
    setBpm.mockClear();
    // This tap resets the buffer — single entry, no setBpm
    fireEvent.mouseDown(btn);
    expect(setBpm).not.toHaveBeenCalled();
  });

  it('BPM clamped to MAX_BPM for very fast taps', () => {
    const setBpm = vi.fn();
    // 50ms interval -> 1200 BPM -> clamped to 300
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1050);
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(300);
  });

  it('BPM clamped to MIN_BPM for very slow taps', () => {
    const setBpm = vi.fn();
    render(
      <TempoController bpm={120} setBpm={setBpm} />
    );
    const btn = screen.getByRole('button', {
      name: 'Tap tempo',
    });
    // 1999ms interval -> 60000/1999 ≈ 30.0 BPM
    perfSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2999);
    fireEvent.mouseDown(btn);
    fireEvent.mouseDown(btn);
    expect(setBpm).toHaveBeenCalledWith(30);
  });

});
