import { render, screen, fireEvent }
  from '@testing-library/react';
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import TransportControls from '../app/TransportControls';
import { TestWrapper } from './helpers/sequencer-wrapper';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    requestReset: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    onStep: vi.fn(),
  },
}));

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    sendNote: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    init: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({
      enabled: false,
    }),
    getOutputs: vi.fn().mockReturnValue([]),
    setOnDeviceChange: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

beforeEach(() => {
  Element.prototype.setPointerCapture =
    vi.fn() as never;
});

function renderTransport() {
  const mockTrigger = (
    <button aria-label="Pattern">Mock Pattern</button>
  );
  return render(
    <TestWrapper>
      <TransportControls
        patternTrigger={mockTrigger}
      />
    </TestWrapper>
  );
}

describe('TransportControls', () => {
  it('renders pattern trigger button', () => {
    renderTransport();
    expect(
      screen.getByRole('button', { name: /pattern/i })
    ).toBeInTheDocument();
  });

  it('renders pattern trigger text', () => {
    renderTransport();
    const trigger = screen.getByRole('button', {
      name: /pattern/i,
    });
    expect(trigger).toHaveTextContent('Mock Pattern');
  });

  it('play button has aria-label and aria-pressed',
    () => {
      renderTransport();
      const play = screen.getByRole('button', {
        name: /start playback/i,
      });
      expect(play).toHaveAttribute(
        'aria-pressed', 'false'
      );
    }
  );

  it('play button shows PLAY text when stopped', () => {
    renderTransport();
    const play = screen.getByRole('button', {
      name: /start playback/i,
    });
    expect(play).toHaveTextContent('PLAY');
  });

  it('kit selector renders with options', () => {
    renderTransport();
    const select = screen.getByLabelText('Kit');
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe('SELECT');
  });

  it('BPM input is present', () => {
    renderTransport();
    const bpmInput = screen.getByLabelText('BPM');
    expect(bpmInput).toBeInTheDocument();
    expect(bpmInput).toHaveAttribute(
      'type', 'number'
    );
  });

  it('play button is disabled when not loaded', () => {
    renderTransport();
    // Default state: isLoaded starts false
    // until kit preload resolves
    const play = screen.getByRole('button', {
      name: /start playback/i,
    });
    // Initially disabled (kit not loaded yet)
    expect(play).toBeDisabled();
  });

  it('changing kit selector triggers setKit', () => {
    renderTransport();
    const select = screen.getByLabelText('Kit');
    fireEvent.change(select, {
      target: { value: 'electro' },
    });
    // Kit should now show electro selected
    expect(
      (select as HTMLSelectElement).value
    ).toBe('electro');
  });
});
