import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomSampleDot from '../app/CustomSampleDot';

describe('CustomSampleDot', () => {
  it('names the file for screen readers', () => {
    render(<CustomSampleDot fileName="kick.wav" isOn />);
    expect(screen.getByRole('button', {
      name: 'Custom sample: kick.wav',
    })).toBeInTheDocument();
  });

  it('shows a solid dot and explains it when on', () => {
    render(<CustomSampleDot fileName="kick.wav" isOn />);
    const dot = screen.getByRole('button');
    expect(dot).toHaveAttribute('aria-pressed', 'true');
    expect(dot).toHaveAttribute(
      'title',
      'Custom sample on: kick.wav. Click to use the kit sample.'
    );
    expect(dot.firstElementChild).toHaveClass('bg-accent');
  });

  it('shows a hollow dot and explains it when off', () => {
    render(<CustomSampleDot fileName="kick.wav" isOn={false} />);
    const dot = screen.getByRole('button');
    expect(dot).toHaveAttribute('aria-pressed', 'false');
    expect(dot).toHaveAttribute(
      'title',
      'Custom sample off: kick.wav. Click to use it again.'
    );
    expect(dot.firstElementChild).toHaveClass('bg-transparent');
    expect(dot.firstElementChild).toHaveClass('border-accent');
  });

  it('toggles on click without reaching its parent', () => {
    const onToggle = vi.fn();
    const onParentDown = vi.fn();
    const onParentClick = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onMouseDown={onParentDown} onClick={onParentClick}>
        <CustomSampleDot
          fileName="kick.wav"
          isOn
          onToggle={onToggle}
        />
      </div>
    );
    const dot = screen.getByRole('button');
    fireEvent.mouseDown(dot);
    fireEvent.click(dot);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onParentDown).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
