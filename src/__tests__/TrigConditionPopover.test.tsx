import { render, screen, fireEvent }
  from '@testing-library/react';
import { describe, it, expect, vi, beforeEach }
  from 'vitest';
import TrigConditionPopover
  from '../app/TrigConditionPopover';

const mockSet = vi.fn();
const mockClear = vi.fn();

vi.mock('../app/SequencerContext', () => ({
  useSequencer: () => ({
    actions: {
      setTrigCondition: mockSet,
      clearTrigCondition: mockClear,
    },
  }),
}));

const base = {
  trackId: 'bd' as const,
  stepIndex: 3,
  conditions: undefined as undefined,
  onClose: vi.fn(),
};

describe('TrigConditionPopover', () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockClear.mockClear();
    base.onClose.mockClear();
  });

  it('header shows step number + track abbrev',
    () => {
      render(<TrigConditionPopover {...base} />);
      expect(
        screen.getByText(/Step 4/)
      ).toBeTruthy();
      expect(
        screen.getByText(/BD/)
      ).toBeTruthy();
    }
  );

  it('slider defaults to 100', () => {
    render(<TrigConditionPopover {...base} />);
    expect(
      screen.getByRole('slider')
        .getAttribute('aria-valuenow')
    ).toBe('100');
  });

  it('cycle defaults to 1:1', () => {
    render(<TrigConditionPopover {...base} />);
    const sel = screen.getByRole(
      'combobox'
    ) as HTMLSelectElement;
    expect(sel.value).toBe('1:1');
  });

  it('changing cycle calls setTrigCondition',
    () => {
      render(<TrigConditionPopover {...base} />);
      fireEvent.change(
        screen.getByRole('combobox'),
        { target: { value: '2:4' } }
      );
      expect(mockSet).toHaveBeenCalledWith(
        'bd', 3, { cycle: { a: 2, b: 4 } }
      );
    }
  );

  it('all defaults calls clearTrigCondition',
    () => {
      render(
        <TrigConditionPopover
          {...base}
          conditions={{ probability: 50 }}
        />
      );
      fireEvent.keyDown(
        screen.getByRole('slider'), { key: 'End' }
      );
      expect(mockClear).toHaveBeenCalledWith(
        'bd', 3
      );
    }
  );

  it('Escape calls onClose', () => {
    render(<TrigConditionPopover {...base} />);
    fireEvent.keyDown(
      document, { key: 'Escape' }
    );
    expect(base.onClose).toHaveBeenCalled();
  });

  it('click outside calls onClose', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <TrigConditionPopover
          {...base}
          onClose={onClose}
        />
      </div>
    );
    vi.advanceTimersByTime(1);
    fireEvent.mouseDown(
      screen.getByTestId('outside')
    );
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('pre-populates from existing conditions',
    () => {
      render(
        <TrigConditionPopover
          {...base}
          conditions={{
            probability: 75,
            cycle: { a: 1, b: 3 },
          }}
        />
      );
      expect(
        screen.getByRole('slider')
          .getAttribute('aria-valuenow')
      ).toBe('75');
      const sel2 = screen.getByRole(
        'combobox'
      ) as HTMLSelectElement;
      expect(sel2.value).toBe('1:3');
    }
  );
});
