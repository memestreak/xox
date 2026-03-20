import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalControls from '../app/GlobalControls';

// Mock SequencerContext
const mockSetPatternLength = vi.fn();
const mockSetSwing = vi.fn();
const mockClearAll = vi.fn();

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => ({
    state: {
      patternLength: 16,
      swing: 0,
    },
    actions: {
      setPatternLength: mockSetPatternLength,
      setSwing: mockSetSwing,
      clearAll: mockClearAll,
    },
  }),
}));

describe('GlobalControls', () => {
  it('renders steps dropdown', () => {
    render(<GlobalControls />);
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
    expect(
      (select as HTMLSelectElement).value
    ).toBe('16');
  });

  it('renders swing knob', () => {
    render(<GlobalControls />);
    const knob = screen.getByRole('slider');
    expect(knob).toBeDefined();
  });

  it('renders clear button', () => {
    render(<GlobalControls />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDefined();
  });

  it('steps change calls setPatternLength', () => {
    render(<GlobalControls />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, {
      target: { value: '8' },
    });
    expect(mockSetPatternLength).toHaveBeenCalledWith(8);
  });

  it('clear button calls clearAll', () => {
    render(<GlobalControls />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(mockClearAll).toHaveBeenCalled();
  });

  it('swing knob calls setSwing', () => {
    render(<GlobalControls />);
    const knob = screen.getByRole('slider');
    // Simulate keyboard interaction (ArrowUp)
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(mockSetSwing).toHaveBeenCalled();
  });

  it('renders 64 step options', () => {
    render(<GlobalControls />);
    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(64);
    expect(options[0].value).toBe('1');
    expect(options[63].value).toBe('64');
  });
});
