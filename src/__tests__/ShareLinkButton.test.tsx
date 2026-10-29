import {
  act, render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import {
  beforeAll, describe, expect, it, vi,
} from 'vitest';
import ShareLinkButton from '../app/ShareLinkButton';
import { TestWrapper } from './helpers/sequencer-wrapper';
import { useSequencer } from '../app/SequencerContext';

/** Loads a WAV onto SD, as the track menu would. */
function LoadSampleButton() {
  const { actions } = useSequencer();
  return (
    <button
      onClick={() =>
        actions.loadSample(
          'sd', new File(['x'], 'snare.wav', { type: 'audio/wav' })
        )
      }
    >
      load sample
    </button>
  );
}

// jsdom doesn't implement HTMLDialogElement methods
beforeAll(() => {
  HTMLDialogElement.prototype.showModal =
    vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
  HTMLDialogElement.prototype.close =
    vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
});

vi.mock('../app/AudioEngine', () => ({
  audioEngine: {
    preloadKit: vi.fn().mockResolvedValue(true),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setPatternLength: vi.fn(),
    playSound: vi.fn(),
    onStep: vi.fn(),
    decodeSample: vi.fn().mockResolvedValue({}),
    setCustomSample: vi.fn(),
    clearCustomSample: vi.fn(),
    clearCustomSamples: vi.fn(),
  },
}));

function renderShare() {
  return render(
    <TestWrapper>
      <ShareLinkButton />
      <LoadSampleButton />
    </TestWrapper>
  );
}

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true,
  });
}

describe('ShareLinkButton', () => {
  it('copies a share URL without changing the address bar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    const replaceState = vi.spyOn(
      window.history, 'replaceState'
    );
    renderShare();

    // fireEvent avoids userEvent's clipboard layer.
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy share link' })
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Copied!'
      );
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0] as string).toContain('#');
    // Writing the hash would make a later refresh restore
    // this snapshot instead of the autosaved session.
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it('says so when the copy fails', async () => {
    mockClipboard(
      vi.fn().mockRejectedValue(new Error('denied'))
    );
    renderShare();
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy share link' })
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Copy failed'
      );
    });
  });

  it('notes custom samples are left out', async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    renderShare();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'load sample' })
      );
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy share link' })
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        "Copied! Custom samples aren't included."
      );
    });
  });
});
