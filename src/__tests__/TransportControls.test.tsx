import {
  render, screen, fireEvent, waitFor, within,
} from '@testing-library/react';
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import TransportControls from '../app/TransportControls';
import { TestWrapper } from './helpers/sequencer-wrapper';
import { audioEngine } from '../app/AudioEngine';
import kitsData from '../app/data/kits.json';
import { BPM_MAX, BPM_MIN } from '../app/constants';
import { HelpProvider } from '../app/HelpContext';

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    requestReset: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    setOutputVolume: vi.fn(),
    getOutputPeaks: vi.fn().mockReturnValue([0, 0]),
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
  vi.clearAllMocks();
  vi.mocked(audioEngine.preloadKit).mockResolvedValue(true);
  Element.prototype.setPointerCapture =
    vi.fn() as never;
});

const page = {
  currentPage: 0,
  playingPage: -1,
  pageCount: 1,
  autoFollow: true,
  setPage: vi.fn(),
  setAutoFollow: vi.fn(),
};

function renderTransport() {
  const mockTrigger = (
    <button aria-label="Pattern">Mock Pattern</button>
  );
  return render(
    <TestWrapper>
      <TransportControls
        patternTrigger={mockTrigger}
        page={page}
      />
    </TestWrapper>
  );
}

/** Render and wait for the kit preload to finish. */
async function renderLoaded() {
  renderTransport();
  const play = screen.getByRole('button', {
    name: /start playback/i,
  });
  await waitFor(() => expect(play).toBeEnabled());
  return play;
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
    // STOP is laid out (so the key keeps its width)
    // but hidden.
    expect(screen.getByText('PLAY')).not.toHaveClass('invisible');
    expect(screen.getByText('STOP')).toHaveClass('invisible');
  });

  it('kit selector renders with options', () => {
    renderTransport();
    const select = screen.getByRole('combobox', {
      name: 'Kit',
    });
    expect(select).toHaveTextContent('808');
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
    const select = screen.getByRole('combobox', {
      name: 'Kit',
    });
    fireEvent.click(select);
    fireEvent.click(
      screen.getByRole('option', { name: 'Electro' })
    );
    // The key now shows the new kit
    expect(select).toHaveTextContent('Electro');
  });

  it('play button enables once the kit loads', async () => {
    const play = await renderLoaded();
    expect(play).not.toHaveClass('cursor-wait');
  });

  it('clicking play starts the engine and flips state',
    async () => {
      const play = await renderLoaded();
      fireEvent.click(play);
      expect(audioEngine.start).toHaveBeenCalledTimes(1);
      const stop = screen.getByRole('button', {
        name: /stop playback/i,
      });
      expect(stop).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('STOP')).not.toHaveClass('invisible');
      expect(screen.getByText('PLAY')).toHaveClass('invisible');
    }
  );

  it('clicking stop stops the engine', async () => {
    const play = await renderLoaded();
    fireEvent.click(play);
    fireEvent.click(
      screen.getByRole('button', { name: /stop playback/i })
    );
    expect(audioEngine.stop).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /start playback/i })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('typing a BPM updates the input and engine', async () => {
    await renderLoaded();
    const bpm = screen.getByLabelText('BPM');
    fireEvent.change(bpm, { target: { value: '132' } });
    expect(bpm).toHaveValue(132);
    await waitFor(() =>
      expect(audioEngine.setBpm).toHaveBeenLastCalledWith(132)
    );
  });

  it('BPM input clamps out-of-range values on blur', () => {
    renderTransport();
    const bpm = screen.getByLabelText('BPM');
    fireEvent.change(bpm, { target: { value: '999' } });
    fireEvent.blur(bpm);
    expect(bpm).toHaveValue(BPM_MAX);
    fireEvent.change(bpm, { target: { value: '1' } });
    fireEvent.blur(bpm);
    expect(bpm).toHaveValue(BPM_MIN);
  });

  it('kit selector lists every kit', () => {
    renderTransport();
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Kit' })
    );
    const list = screen.getByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options.map(o => o.textContent))
      .toEqual(kitsData.kits.map(k => k.name));
  });

  it('changing kit preloads the new kit folder', async () => {
    renderTransport();
    const electro = kitsData.kits.find(
      k => k.id === 'electro'
    )!;
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Kit' })
    );
    fireEvent.click(
      screen.getByRole('option', { name: electro.name })
    );
    await waitFor(() =>
      expect(audioEngine.preloadKit)
        .toHaveBeenLastCalledWith(electro.folder)
    );
  });

  it('renders Follow and page lights in the strip', () => {
    render(
      <TestWrapper>
        <TransportControls page={{ ...page, pageCount: 2 }} />
      </TestWrapper>
    );
    expect(
      screen.getByRole('button', { name: /auto-follow playhead/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^Page \d/ })
    ).toHaveLength(2);
  });

  it('renders the tap tempo and fill controls', () => {
    renderTransport();
    expect(
      screen.getByRole('button', { name: /tap tempo/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Fill' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Latch fill' })
    ).toBeInTheDocument();
  });

  it('help key has a label and opens Help', () => {
    HTMLDialogElement.prototype.showModal =
      vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      });
    render(
      <TestWrapper>
        <HelpProvider>
          <TransportControls page={page} />
        </HelpProvider>
      </TestWrapper>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Help and shortcuts' })
    );
    expect(
      screen.getByRole('heading', { name: 'Help' })
    ).toBeInTheDocument();
  });
});
