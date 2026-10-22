import {
  fireEvent, render, screen,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CycleEditor from '../app/CycleEditor';
import { CYCLE_OPTIONS } from '../app/trigConditions';

describe('CycleEditor', () => {
  it('renders a labelled select with the current value', () => {
    render(<CycleEditor value="2:4" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', {
      name: 'Cycle',
    });
    expect(select).toHaveValue('2:4');
  });

  it('lists every cycle option', () => {
    render(<CycleEditor value="1:1" onChange={vi.fn()} />);
    const options = screen.getAllByRole('option');
    expect(options.map(o => o.textContent))
      .toEqual(CYCLE_OPTIONS.map(o => o.label));
  });

  it('calls onChange with the chosen label', () => {
    const onChange = vi.fn();
    render(<CycleEditor value="1:1" onChange={onChange} />);
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Cycle' }),
      { target: { value: '3:8' } }
    );
    expect(onChange).toHaveBeenCalledWith('3:8');
  });
});
