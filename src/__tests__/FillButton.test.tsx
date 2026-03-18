import { render, screen, fireEvent }
  from '@testing-library/react';
import { describe, it, expect, vi, beforeEach }
  from 'vitest';
import FillButton from '../app/FillButton';

const mockToggleFillLatch = vi.fn();
const mockSetFillHeld = vi.fn();

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => ({
    state: {
      isFillActive: false,
      fillMode: 'off',
    },
    actions: {
      toggleFillLatch: mockToggleFillLatch,
      setFillHeld: mockSetFillHeld,
    },
  }),
}));

describe('FillButton', () => {
  beforeEach(() => {
    mockToggleFillLatch.mockClear();
    mockSetFillHeld.mockClear();
  });

  it('renders with FILL text', () => {
    render(<FillButton />);
    expect(
      screen.getByText('FILL')
    ).toBeTruthy();
  });

  it('has aria-pressed attribute', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button');
    expect(
      btn.getAttribute('aria-pressed')
    ).toBeDefined();
  });

  it('pointer down activates momentary fill',
    () => {
      render(<FillButton />);
      const btn = screen.getByRole('button');
      fireEvent.pointerDown(btn);
      expect(
        mockSetFillHeld
      ).toHaveBeenCalledWith(true);
    }
  );

  it('pointer up deactivates momentary fill',
    () => {
      render(<FillButton />);
      const btn = screen.getByRole('button');
      fireEvent.pointerDown(btn);
      fireEvent.pointerUp(btn);
      expect(
        mockSetFillHeld
      ).toHaveBeenCalledWith(false);
    }
  );

  it('pointerCancel deactivates fill', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button');
    fireEvent.pointerDown(btn);
    fireEvent.pointerCancel(btn);
    expect(
      mockSetFillHeld
    ).toHaveBeenCalledWith(false);
  });

  it('Cmd+click toggles latch', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn, { metaKey: true });
    expect(
      mockToggleFillLatch
    ).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+click toggles latch', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn, { ctrlKey: true });
    expect(
      mockToggleFillLatch
    ).toHaveBeenCalledTimes(1);
  });

  it('plain click does not toggle latch', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(
      mockToggleFillLatch
    ).not.toHaveBeenCalled();
  });
});
