import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
