import { render, screen, fireEvent, act }
  from '@testing-library/react';
import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import SettingsModal from '../app/SettingsModal';
import { gridPrefs, outputPrefs } from '../app/preferences';
import { midiEngine } from '../app/MidiEngine';
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
    applyConfig: vi.fn(),
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

function renderModal() {
  const onClose = vi.fn();
  const result = render(
    <MidiProvider>
      <SettingsModal onClose={onClose} />
    </MidiProvider>
  );
  return { ...result, onClose };
}

function saved(key: string): unknown {
  const text = window.localStorage.getItem(key);
  return text === null ? null : JSON.parse(text);
}

const button = (name: string) =>
  screen.getByRole('button', { name });

describe('SettingsModal', () => {
  it('opens at Sequencer › Grid, General collapsed', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Settings' }))
      .toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sequencer › Grid' }))
      .toBeInTheDocument();
    expect(button('General')).toHaveAttribute('aria-expanded', 'false');
    expect(button('Sequencer')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Auto-minimize empty tracks'))
      .not.toBeChecked();
  });

  it('opens a group in the tree and shows its section', () => {
    renderModal();
    fireEvent.click(button('General'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Interface' })[0]);
    expect(screen.getByRole('heading', { name: 'General › Interface' }))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Show tooltips')).toBeChecked();
  });

  it('stages changes until Apply, which then disables', () => {
    renderModal();
    expect(button('Apply')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Auto-minimize empty tracks'));
    expect(screen.getByLabelText('Auto-minimize empty tracks')).toBeChecked();
    expect(saved('xox.sequencer.grid')).toBeNull();
    expect(gridPrefs.get().autoMinimize).toBe(false);
    expect(button('Apply')).toBeEnabled();

    fireEvent.click(button('Apply'));
    expect(saved('xox.sequencer.grid')).toEqual({ autoMinimize: true });
    expect(button('Apply')).toBeDisabled();
  });

  it('Apply goes back to disabled when a change is undone', () => {
    renderModal();
    const box = screen.getByLabelText('Auto-minimize empty tracks');
    fireEvent.click(box);
    fireEvent.click(box);
    expect(button('Apply')).toBeDisabled();
  });

  it('OK saves and closes', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText('Auto-minimize empty tracks'));
    fireEvent.click(button('OK'));
    expect(gridPrefs.get().autoMinimize).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ['Cancel', () => fireEvent.click(button('Cancel'))],
    ['the close button', () => fireEvent.click(button('Close'))],
    ['Esc', () => fireEvent.keyDown(
      document.querySelector('dialog')!, { key: 'Escape' }
    )],
  ])('%s discards staged changes', (_name, close) => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText('Auto-minimize empty tracks'));
    close();
    expect(onClose).toHaveBeenCalled();
    expect(saved('xox.sequencer.grid')).toBeNull();
    expect(gridPrefs.get().autoMinimize).toBe(false);
  });

  it('double-clicking a label stages its default', () => {
    gridPrefs.set({ autoMinimize: true });
    renderModal();
    const box = screen.getByLabelText('Auto-minimize empty tracks');
    expect(box).toBeChecked();
    fireEvent.doubleClick(screen.getByText('Auto-minimize empty tracks'));
    expect(box).not.toBeChecked();
    expect(gridPrefs.get().autoMinimize).toBe(true);
    fireEvent.click(button('Apply'));
    expect(gridPrefs.get().autoMinimize).toBe(false);
  });

  it('double-clicking the control does not reset it', () => {
    gridPrefs.set({ autoMinimize: true });
    renderModal();
    const box = screen.getByLabelText('Auto-minimize empty tracks');
    fireEvent.doubleClick(box);
    expect(box).toBeChecked();
  });

  it('a label tells how to reset', () => {
    renderModal();
    expect(screen.getAllByText('Double-click to reset').length)
      .toBeGreaterThan(0);
  });

  it('lists the master volume under Output', () => {
    outputPrefs.set({ volume: 0.5 });
    renderModal();
    fireEvent.click(screen.getAllByRole('button', { name: 'Output' })[0]);
    const fader = screen.getByLabelText('Volume');
    expect(fader).toHaveValue('0.5');
    fireEvent.change(fader, { target: { value: '0.25' } });
    expect(outputPrefs.get().volume).toBe(0.5);
    fireEvent.click(button('Apply'));
    expect(saved('xox.sequencer.output')).toEqual({ volume: 0.25 });
  });

  it('MIDI: turning output on asks for access, and stays off without it', async () => {
    renderModal();
    fireEvent.click(screen.getAllByRole('button', { name: 'MIDI' })[0]);
    const box = screen.getByLabelText('MIDI output');
    await act(async () => {
      fireEvent.click(box);
    });
    expect(midiEngine.init).toHaveBeenCalled();
    expect(box).not.toBeChecked();
    expect(screen.getByText('MIDI not available in this browser'))
      .toBeInTheDocument();
    expect(screen.getByLabelText('Bass Drum')).toHaveValue(36);
  });

  it('has a group picker and section keys for phones', () => {
    renderModal();
    expect(screen.getByRole('combobox', { name: 'Settings group' }))
      .toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sequencer sections' }))
      .toBeInTheDocument();
  });
});
