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
      isFillLatched: false,
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
    const btn = screen.getByRole('button', { name: 'Fill' });
    expect(
      btn.getAttribute('aria-pressed')
    ).toBeDefined();
  });

  it('pointer down activates momentary fill',
    () => {
      render(<FillButton />);
      const btn = screen.getByRole('button', { name: 'Fill' });
      fireEvent.pointerDown(btn);
      expect(
        mockSetFillHeld
      ).toHaveBeenCalledWith(true);
    }
  );

  it('pointer up deactivates momentary fill',
    () => {
      render(<FillButton />);
      const btn = screen.getByRole('button', { name: 'Fill' });
      fireEvent.pointerDown(btn);
      fireEvent.pointerUp(btn);
      expect(
        mockSetFillHeld
      ).toHaveBeenCalledWith(false);
    }
  );

  it('pointerCancel deactivates fill', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button', { name: 'Fill' });
    fireEvent.pointerDown(btn);
    fireEvent.pointerCancel(btn);
    expect(
      mockSetFillHeld
    ).toHaveBeenCalledWith(false);
  });

  it('Cmd+click toggles latch', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button', { name: 'Fill' });
    fireEvent.click(btn, { metaKey: true });
    expect(
      mockToggleFillLatch
    ).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+click toggles latch', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button', { name: 'Fill' });
    fireEvent.click(btn, { ctrlKey: true });
    expect(
      mockToggleFillLatch
    ).toHaveBeenCalledTimes(1);
  });

  it('plain click does not toggle latch', () => {
    render(<FillButton />);
    const btn = screen.getByRole('button', { name: 'Fill' });
    fireEvent.click(btn);
    expect(
      mockToggleFillLatch
    ).not.toHaveBeenCalled();
  });

  it('latch section toggles the latch', () => {
    render(<FillButton />);
    const latch = screen.getByRole('button', {
      name: 'Latch fill',
    });
    expect(latch).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(latch);
    expect(mockToggleFillLatch).toHaveBeenCalledTimes(1);
    expect(mockSetFillHeld).not.toHaveBeenCalled();
  });

  it('groups the body and latch under "Fill"', () => {
    render(<FillButton />);
    expect(
      screen.getByRole('group', { name: 'Fill' })
    ).toBeInTheDocument();
  });
});
