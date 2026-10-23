import { fireEvent, render, screen } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import MasterVolume from '../app/MasterVolume';
import { litSegments } from '../app/LevelMeter';
import { TooltipProvider } from '../app/TooltipContext';
import { METER_FLOOR_DB, METER_SEGMENTS } from '../app/constants';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    getOutputPeaks: vi.fn().mockReturnValue([0, 0]),
  },
}));

function renderFader(
  position: number,
  variant: 'header' | 'strip' = 'strip',
) {
  const onChange = vi.fn();
  render(
    <TooltipProvider>
      <MasterVolume
        position={position}
        onChange={onChange}
        variant={variant}
      />
    </TooltipProvider>
  );
  return onChange;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MasterVolume', () => {
  it('shows the level in dB on the slider and readout', () => {
    renderFader(0.5);
    const slider = screen.getByRole('slider', {
      name: 'Volume',
    });
    // 0.5 on the cubic curve is 0.125, about −18.1 dB.
    expect(slider).toHaveAttribute('aria-valuetext', '−18.1 dB');
    expect(screen.getByText('−18.1 dB')).toBeInTheDocument();
  });

  it('reports fader moves', () => {
    const onChange = renderFader(1);
    fireEvent.change(
      screen.getByRole('slider', { name: 'Volume' }),
      { target: { value: '0.4' } },
    );
    expect(onChange).toHaveBeenCalledWith(0.4);
  });

  it('returns to 0 dB on double-click', () => {
    const onChange = renderFader(0.3);
    fireEvent.doubleClick(
      screen.getByRole('slider', { name: 'Volume' })
    );
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('labels each placement with a distinct id', () => {
    renderFader(1, 'header');
    renderFader(1, 'strip');
    const sliders = screen.getAllByRole('slider', {
      name: 'Volume',
    });
    expect(new Set(sliders.map(s => s.id)).size).toBe(2);
  });
});

describe('litSegments', () => {
  it('is dark at or below the floor', () => {
    expect(litSegments(-Infinity)).toBe(0);
    expect(litSegments(METER_FLOOR_DB)).toBe(0);
  });

  it('lights every segment at full scale and above', () => {
    expect(litSegments(0)).toBe(METER_SEGMENTS);
    expect(litSegments(6)).toBe(METER_SEGMENTS);
  });

  it('lights half the segments halfway up', () => {
    expect(litSegments(METER_FLOOR_DB / 2))
      .toBe(METER_SEGMENTS / 2);
  });
});
