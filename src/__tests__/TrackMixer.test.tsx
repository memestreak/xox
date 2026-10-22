import {
  render, screen, fireEvent,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrackMixer from '../app/TrackMixer';

function renderMixer(overrides = {}) {
  const props = {
    trackName: 'BD',
    isMuted: false,
    isSolo: false,
    gain: 0.8,
    pan: 0.5,
    size: 'lg' as const,
    onToggleMute: vi.fn(),
    onToggleSolo: vi.fn(),
    onSetGain: vi.fn(),
    onSetPan: vi.fn(),
    ...overrides,
  };
  render(<TrackMixer {...props} />);
  return props;
}

describe('TrackMixer', () => {
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
  });

  it('renders mute and solo toggles with pressed state', () => {
    renderMixer({ isMuted: true, isSolo: false });
    expect(
      screen.getByRole('button', { name: /mute bd/i })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /solo bd/i })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onToggleMute and onToggleSolo', () => {
    const props = renderMixer();
    fireEvent.click(
      screen.getByRole('button', { name: /mute bd/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /solo bd/i })
    );
    expect(props.onToggleMute).toHaveBeenCalledTimes(1);
    expect(props.onToggleSolo).toHaveBeenCalledTimes(1);
  });

  it('renders gain and pan knobs with current values', () => {
    renderMixer({ gain: 0.8, pan: 0.25 });
    expect(
      screen.getByRole('slider', { name: 'Volume BD' })
    ).toHaveAttribute('aria-valuenow', '80');
    expect(
      screen.getByRole('slider', { name: 'Pan BD' })
    ).toHaveAttribute('aria-valuenow', '25');
  });

  it('gain knob keyboard input calls onSetGain', () => {
    const props = renderMixer({ gain: 0.5 });
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Volume BD' }),
      { key: 'End' }
    );
    expect(props.onSetGain).toHaveBeenCalledWith(1);
    expect(props.onSetPan).not.toHaveBeenCalled();
  });

  it('pan knob keyboard input calls onSetPan', () => {
    const props = renderMixer({ pan: 0.5 });
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Pan BD' }),
      { key: 'Home' }
    );
    expect(props.onSetPan).toHaveBeenCalledWith(0);
    expect(props.onSetGain).not.toHaveBeenCalled();
  });

  it('pan knob double-click resets to center', () => {
    const props = renderMixer({ pan: 0.1 });
    fireEvent.click(
      screen.getByRole('slider', { name: 'Pan BD' }),
      { detail: 2 }
    );
    expect(props.onSetPan).toHaveBeenCalledWith(0.5);
  });

  it('pan knob shows formatted pan as valuetext', () => {
    renderMixer({ pan: 0.5 });
    expect(
      screen.getByRole('slider', { name: 'Pan BD' })
    ).toHaveAttribute('aria-valuetext', 'C');
  });

  it('gain knob has no reset-to-default', () => {
    const props = renderMixer({ gain: 0.3 });
    fireEvent.click(
      screen.getByRole('slider', { name: 'Volume BD' }),
      { detail: 2 }
    );
    expect(props.onSetGain).not.toHaveBeenCalled();
  });
});
