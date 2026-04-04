import { render, screen, fireEvent, waitFor }
  from '@testing-library/react';
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import SettingsModal from '../app/SettingsModal';
import { TooltipProvider } from '../app/TooltipContext';
import { MidiProvider } from '../app/MidiContext';

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    init: vi.fn().mockResolvedValue(false),
    getConfig: vi.fn().mockReturnValue({
      enabled: false,
      deviceId: null,
      channel: 10,
      noteLength: { type: 'fixed', ms: 50 },
      tracks: {
        bd: { noteNumber: 36 },
        sd: { noteNumber: 38 },
        ch: { noteNumber: 42 },
        oh: { noteNumber: 46 },
        cy: { noteNumber: 49 },
        ht: { noteNumber: 50 },
        mt: { noteNumber: 47 },
        lt: { noteNumber: 43 },
        rs: { noteNumber: 37 },
        cp: { noteNumber: 39 },
        cb: { noteNumber: 56 },
      },
    }),
    getOutputs: vi.fn().mockReturnValue([]),
    setOnDeviceChange: vi.fn(),
    updateConfig: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(false),
  },
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal =
    vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    }) as never;
  HTMLDialogElement.prototype.close =
    vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    }) as never;
});

function renderModal(open = true) {
  const onClose = vi.fn();
  const result = render(
    <TooltipProvider>
      <MidiProvider>
        <SettingsModal
          open={open}
          onClose={onClose}
        />
      </MidiProvider>
    </TooltipProvider>
  );
  return { ...result, onClose };
}

describe('SettingsModal', () => {
  it('renders dialog element', () => {
    renderModal();
    const dialog = document.querySelector('dialog');
    expect(dialog).toBeInTheDocument();
  });

  it('renders Settings heading', () => {
    renderModal();
    expect(screen.getByText('Settings'))
      .toBeInTheDocument();
  });

  it('renders Options tab label', () => {
    renderModal();
    expect(screen.getByText('Options'))
      .toBeInTheDocument();
  });

  it('has tooltips checkbox', () => {
    renderModal();
    const checkbox = screen.getByLabelText(
      'Show tooltips'
    );
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it('toggling tooltips checkbox works', () => {
    renderModal();
    const checkbox = screen.getByLabelText(
      'Show tooltips'
    );
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('switches to MIDI tab', async () => {
    renderModal();
    const midiTab = screen.getByText('MIDI');
    fireEvent.click(midiTab);
    await waitFor(() => {
      expect(screen.getByLabelText(
        'Enable MIDI output'
      )).toBeInTheDocument();
    });
  });

  it('close button calls onClose', () => {
    const { onClose } = renderModal();
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
