import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import ExportKitDialog from '../app/ExportKitDialog';
import type { Kit } from '../app/types';
import type {
  CustomSamples, DisabledSamples,
} from '../app/hooks/useCustomSamples';

const kit: Kit = { id: 'electro', name: 'Electro', folder: 'electro' };

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

function renderDialog(opts: {
  custom?: CustomSamples;
  disabled?: DisabledSamples;
  fetchSample?: (k: Kit, slot: string) => Promise<Uint8Array>;
} = {}) {
  const onClose = vi.fn();
  const download = vi.fn();
  const fetchSample = opts.fetchSample
    ?? vi.fn(async () => new Uint8Array([1]));
  render(
    <ExportKitDialog
      isOpen
      onClose={onClose}
      kit={kit}
      customSamples={opts.custom ?? {}}
      disabledSamples={opts.disabled ?? {}}
      fetchSample={fetchSample}
      download={download}
    />
  );
  return { onClose, download, fetchSample };
}

const nameField = () => screen.getByLabelText('Name');
const idField = () => screen.getByLabelText(/^ID/);
const exportButton = () => screen.getByRole('button', { name: 'Export' });

describe('ExportKitDialog', () => {
  it('opens with defaults from the current kit', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Export kit' }))
      .toBeInTheDocument();
    expect(nameField()).toHaveValue('Electro custom');
    expect(idField()).toHaveValue('electro-custom');
    expect(screen.getByText(/copy of Electro/)).toBeInTheDocument();
  });

  it('the ID follows the name until it is edited', () => {
    renderDialog();
    fireEvent.change(nameField(), { target: { value: 'Boom Bap 2' } });
    expect(idField()).toHaveValue('boom-bap-2');
    fireEvent.change(idField(), { target: { value: 'bb' } });
    fireEvent.change(nameField(), { target: { value: 'Other' } });
    expect(idField()).toHaveValue('bb');
  });

  it('an invalid ID disables Export', () => {
    renderDialog();
    fireEvent.change(idField(), { target: { value: 'Bad ID' } });
    expect(exportButton()).toBeDisabled();
    expect(idField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/lowercase letters/)).toBeInTheDocument();
  });

  it('lists custom samples that are on', () => {
    renderDialog({
      custom: {
        cp: new File(['x'], 'clap.wav'),
        sd: new File(['x'], 'snare.wav'),
      },
      disabled: { sd: true },
    });
    const list = screen.getByRole('list', { name: 'Samples in this kit' });
    expect(within(list).getByText('clap.wav')).toBeInTheDocument();
    expect(within(list).queryByText('snare.wav')).not.toBeInTheDocument();
    expect(within(list).getAllByText('kit')).toHaveLength(10);
  });

  it('downloads <id>.zip and closes', async () => {
    const { download, onClose } = renderDialog();
    fireEvent.click(exportButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(download).toHaveBeenCalledWith(
      expect.any(Uint8Array), 'electro-custom.zip'
    );
  });

  it('shows a failure and stays open', async () => {
    const { download, onClose } = renderDialog({
      fetchSample: async () => {
        throw new Error('HTTP 500');
      },
    });
    fireEvent.click(exportButton());
    expect(await screen.findByRole('alert'))
      .toHaveTextContent(/Couldn't read the Electro bd sample/);
    expect(download).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(exportButton()).toBeEnabled();
  });

  it('Cancel closes', () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
