"use client";

import {
  useCallback, useEffect, useId, useRef, useState,
} from 'react';
import type { Kit } from './types';
import { TRACKS } from './types';
import type {
  CustomSamples, DisabledSamples,
} from './hooks/useCustomSamples';
import {
  buildKitZip, defaultExportName, exportPlan, isValidKitId,
  slugify,
} from './kitExport';
import type { FetchKitSample } from './kitExport';

/** Saves `data` as a file through a temporary link. */
export function downloadFile(data: Uint8Array, fileName: string) {
  const blob = new Blob([data as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Let the download start before freeing the bytes.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface ExportKitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kit the non-custom slots come from. */
  kit: Kit;
  customSamples: CustomSamples;
  disabledSamples: DisabledSamples;
  /** Injected in tests. */
  fetchSample?: FetchKitSample;
  download?: (data: Uint8Array, fileName: string) => void;
}

const TRACK_NAMES = Object.fromEntries(
  TRACKS.map(t => [t.id, t.name])
);

const FIELD =
  'w-full mt-1 px-2.5 py-1.5 rounded-[5px] bg-well text-ink'
  + ' font-mono text-sm border border-line'
  + ' focus-visible:outline-2 focus-visible:outline-accent';

/**
 * Kit menu (right-click the Kit key) > Export kit...:
 * names the kit and downloads
 * a zip for `scripts/kit_builder/import_kit.py`. Mount it
 * with a fresh `key` per open so fields start from the
 * defaults.
 */
export default function ExportKitDialog({
  isOpen,
  onClose,
  kit,
  customSamples,
  disabledSamples,
  fetchSample,
  download = downloadFile,
}: ExportKitDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const nameId = useId();
  const idId = useId();
  const hintId = useId();
  const [name, setName] = useState(() => defaultExportName(kit));
  // null: the ID follows the name.
  const [idEdit, setIdEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = idEdit ?? slugify(name);
  const idValid = isValidKitId(id);
  const plan = exportPlan(customSamples, disabledSamples);
  const customCount = plan.filter(s => s.file).length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose]
  );

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const zip = await buildKitZip({
        kit, id, name: name.trim() || id, plan, fetchSample,
      });
      download(zip, `${id}.zip`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="ss-menu m-auto backdrop:bg-black/60 rounded-xl text-ink p-0 max-w-md w-full"
    >
      <form className="p-6 flex flex-col gap-4" onSubmit={handleExport}>
        <div className="flex justify-between items-center">
          <h2 id={titleId} className="ss-cap text-xl">
            Export kit
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ss-key w-8 h-8 flex items-center justify-center text-muted hover:text-ink text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-muted">
          Downloads a zip for{' '}
          <code className="font-mono text-ink">import_kit.py</code>.
          {customCount === 0
            ? ` No custom samples are on, so it's a copy of ${kit.name}.`
            : ` Other slots use ${kit.name}.`}
        </p>

        <label htmlFor={nameId} className="ss-label text-xs">
          Name
          <input
            id={nameId}
            type="text"
            aria-label="Name"
            autoComplete="off"
            value={name}
            onChange={e => setName(e.target.value)}
            className={FIELD}
          />
        </label>

        <label htmlFor={idId} className="ss-label text-xs">
          ID
          <input
            id={idId}
            type="text"
            aria-label="ID"
            autoComplete="off"
            spellCheck={false}
            value={id}
            aria-invalid={!idValid}
            aria-describedby={hintId}
            onChange={e => setIdEdit(e.target.value)}
            className={FIELD}
          />
          <span
            id={hintId}
            className={
              'block mt-1 normal-case tracking-normal font-sans text-xs '
              + (idValid ? 'text-muted' : 'text-[#ff8a62]')
            }
          >
            {idValid
              ? `Saved as ${id}.zip`
              : 'Use lowercase letters, digits and single hyphens.'}
          </span>
        </label>

        <ul
          aria-label="Samples in this kit"
          className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs"
        >
          {plan.map(({ slot, file }) => (
            <li key={slot} className="flex gap-2 min-w-0">
              <span className="w-8 shrink-0 font-display font-bold uppercase text-muted">
                {TRACK_NAMES[slot] ?? slot}
              </span>
              <span
                className={'truncate ' + (file ? 'text-accent' : 'text-muted')}
                title={file?.name}
              >
                {file ? file.name : 'kit'}
              </span>
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="text-sm text-[#ff8a62]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ss-key px-4 h-9 rounded-lg text-sm text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!idValid || busy}
            className="ss-key px-4 h-9 rounded-lg text-sm text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
