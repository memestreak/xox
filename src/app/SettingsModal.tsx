"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { LongPressEventType, useLongPress } from 'use-long-press';
import { useHelp } from './HelpContext';
import { useMidi } from './MidiContext';
import { TRACKS, defaultMidiConfig } from './types';
import type { MidiConfig, NoteLength, TrackId } from './types';
import LcdSelect from './LcdSelect';
import Tooltip from './Tooltip';
import tooltips from './data/tooltips.json';
import {
  GRID_DEFAULTS,
  INTERFACE_DEFAULTS,
  PATTERNS_DEFAULTS,
  gridPrefs,
  interfacePrefs,
  patternsPrefs,
} from './preferences';
import type {
  GridPrefs, InterfacePrefs, PatternsPrefs,
} from './preferences';
import { LONG_PRESS_CANCEL_PX, LONG_PRESS_MS } from './constants';

/* ── The tree ────────────────────────────────── */

type SectionId = 'interface' | 'grid' | 'patterns' | 'midi';
type GroupId = 'general' | 'sequencer';

interface Group {
  id: GroupId;
  label: string;
  sections: { id: SectionId; label: string }[];
}

const GROUPS: Group[] = [
  {
    id: 'general',
    label: 'General',
    sections: [{ id: 'interface', label: 'Interface' }],
  },
  {
    id: 'sequencer',
    label: 'Sequencer',
    sections: [
      { id: 'grid', label: 'Grid' },
      { id: 'patterns', label: 'Patterns' },
      { id: 'midi', label: 'MIDI' },
    ],
  },
];

/** The gear opens here: the page's group, first section. */
const OPENING_GROUP: GroupId = 'sequencer';

function groupOf(section: SectionId): Group {
  return GROUPS.find(g => g.sections.some(s => s.id === section))!;
}

function sectionLabel(section: SectionId): string {
  return groupOf(section).sections.find(s => s.id === section)!.label;
}

/* ── Staged values ───────────────────────────── */

/** Every section's values, as saved or as staged. */
interface AllPrefs {
  interface: InterfacePrefs;
  grid: GridPrefs;
  patterns: PatternsPrefs;
  midi: MidiConfig;
}

const SECTION_IDS: SectionId[] = [
  'interface', 'grid', 'patterns', 'midi',
];

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── MIDI choices ────────────────────────────── */

const NOTE_LENGTH_OPTIONS: {
  label: string;
  value: NoteLength;
}[] = [
  { label: '10 ms',
    value: { type: 'fixed', ms: 10 } },
  { label: '25 ms',
    value: { type: 'fixed', ms: 25 } },
  { label: '50 ms',
    value: { type: 'fixed', ms: 50 } },
  { label: '100 ms',
    value: { type: 'fixed', ms: 100 } },
  { label: '50% of step',
    value: { type: 'percent', value: 50 } },
  { label: '75% of step',
    value: { type: 'percent', value: 75 } },
];

function noteLengthKey(nl: NoteLength): string {
  return nl.type === 'fixed'
    ? `fixed-${nl.ms}`
    : `percent-${nl.value}`;
}

const NOTE_LENGTH_SELECT_OPTIONS = NOTE_LENGTH_OPTIONS.map(
  o => ({ value: noteLengthKey(o.value), label: o.label })
);

type MidiTrackId = Exclude<TrackId, 'ac'>;

/** Full track name, e.g. "Bass Drum". */
function trackLabel(id: TrackId): string {
  return (tooltips as Record<string, string>)[`track-${id}`]
    ?? id.toUpperCase();
}

const NUMBER_FIELD_CLASS =
  'h-9 bg-well border border-line rounded-md px-3 font-mono'
  + ' text-sm text-ink disabled:opacity-50'
  + ' focus-visible:outline-2 focus-visible:outline-accent';

const CHECKBOX_CLASS = 'accent-[#f0662a] w-4 h-4';

/* ── Dialog ──────────────────────────────────── */

interface SettingsModalProps {
  /** Called when the dialog closes (OK, Cancel, Esc, ×). */
  onClose: () => void;
}

/**
 * The Settings dialog: every preference, in a tree of
 * groups and sections (REAPER-style). Mounted open.
 * Changes are staged: OK saves and closes, Apply saves
 * and stays, Cancel / Esc / × discard them. Double-click
 * (touch: long-press) a field's label to reset it to
 * its default, staged like any other change.
 */
export default function SettingsModal({ onClose }: SettingsModalProps) {
  const help = useHelp();
  const midi = useMidi();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  // What is saved now. Settings is modal, so only Apply
  // and OK change these while it is open.
  const saved: AllPrefs = {
    interface: interfacePrefs.useValue(),
    grid: gridPrefs.useValue(),
    patterns: patternsPrefs.useValue(),
    midi: midi?.config ?? defaultMidiConfig(),
  };
  const [draft, setDraft] = useState<AllPrefs>(saved);

  const [section, setSection] = useState<SectionId>(
    GROUPS.find(g => g.id === OPENING_GROUP)!.sections[0].id
  );
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(
    { general: false, sequencer: false, [OPENING_GROUP]: true }
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const changed = (id: SectionId) => !sameValue(draft[id], saved[id]);
  const dirty = SECTION_IDS.some(changed);

  const apply = () => {
    if (changed('interface')) interfacePrefs.set(draft.interface);
    if (changed('grid')) gridPrefs.set(draft.grid);
    if (changed('patterns')) patternsPrefs.set(draft.patterns);
    if (changed('midi')) midi?.applyConfig(draft.midi);
  };

  /** Stage new values for some fields of one section. */
  const stage = <K extends SectionId>(
    id: K, partial: Partial<AllPrefs[K]>,
  ) => {
    setDraft(d => ({ ...d, [id]: { ...d[id], ...partial } }));
  };

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose]
  );

  const group = groupOf(section);

  const selectGroup = (id: GroupId) => {
    setExpanded(x => ({ ...x, [id]: true }));
    setSection(GROUPS.find(g => g.id === id)!.sections[0].id);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label="Settings"
      onClose={onClose}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="ss-menu m-auto backdrop:bg-black/60 rounded-xl text-ink p-0 overflow-hidden max-w-2xl w-[calc(100%-32px)] h-[min(540px,calc(100dvh-32px))] max-h-none"
    >
      {/* A fixed size: the tree and the pane scroll inside it,
          so switching sections never resizes the dialog. */}
      <div className="h-full p-4 sm:p-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="ss-cap text-xl">
            Settings
          </h2>
          <div className="flex gap-2">
            {/* The way into Help on phones, where the
                header has no room for the ? key. */}
            <button
              type="button"
              onClick={() => {
                onClose();
                help.open();
              }}
              aria-label="Help and shortcuts"
              className="ss-key w-8 h-8 flex items-center justify-center text-muted hover:text-ink font-display font-bold text-lg leading-none"
            >
              ?
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ss-key w-8 h-8 flex items-center justify-center text-muted hover:text-ink text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Phones: group picker, then the group's sections */}
        <div className="sm:hidden flex flex-col gap-2">
          <LcdSelect
            aria-label="Settings group"
            value={group.id}
            options={GROUPS.map(g => ({ value: g.id, label: g.label }))}
            onChange={selectGroup}
            className="w-full h-9"
          />
          <div
            role="group"
            aria-label={`${group.label} sections`}
            className="ss-scroll flex gap-1.5 overflow-x-auto pb-1"
          >
            {group.sections.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                aria-current={s.id === section ? 'true' : undefined}
                className={
                  'ss-cap shrink-0 h-8 px-3 rounded-md text-sm border '
                  + (s.id === section
                    ? 'bg-accent border-accent text-[#1a0d05]'
                    : 'border-line text-muted hover:text-ink')
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex gap-4">
          {/* Desktop: the tree */}
          <nav
            aria-label="Settings sections"
            className="ss-scroll hidden sm:block w-36 shrink-0 overflow-y-auto"
          >
            <ul className="flex flex-col gap-1">
              {GROUPS.map(g => (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-expanded={expanded[g.id]}
                    onClick={() => setExpanded(
                      x => ({ ...x, [g.id]: !x[g.id] })
                    )}
                    className="ss-cap w-full text-left text-sm px-1.5 py-1 rounded-md text-ink hover:bg-well"
                  >
                    <span aria-hidden="true" className="inline-block w-4 text-muted">
                      {expanded[g.id] ? '▾' : '▸'}
                    </span>
                    {g.label}
                  </button>
                  {expanded[g.id] && (
                    <ul className="flex flex-col gap-0.5 mt-0.5">
                      {g.sections.map(s => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => setSection(s.id)}
                            aria-current={s.id === section ? 'true' : undefined}
                            className={
                              'w-full text-left text-sm pl-6 pr-2 py-1 rounded-md border '
                              + (s.id === section
                                ? 'bg-accent border-accent text-[#1a0d05] font-medium'
                                : 'border-transparent text-muted hover:text-ink hover:bg-well')
                            }
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* The selected section */}
          <section
            aria-labelledby={headingId}
            className="ss-panel rounded-lg flex-1 min-w-0 flex flex-col"
          >
            <h3 id={headingId} className="ss-label px-4 pt-4 pb-2 shrink-0">
              {group.label} › {sectionLabel(section)}
            </h3>
            <div className="ss-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {section === 'interface' && (
              <Field
                label="Show tooltips"
                onReset={() => stage('interface', INTERFACE_DEFAULTS)}
              >
                {labelId => (
                  <input
                    type="checkbox"
                    aria-labelledby={labelId}
                    checked={draft.interface.showTooltips}
                    onChange={e => stage(
                      'interface', { showTooltips: e.target.checked }
                    )}
                    className={CHECKBOX_CLASS}
                  />
                )}
              </Field>
            )}
            {section === 'grid' && (
              <Field
                label="Auto-minimize empty tracks"
                onReset={() => stage('grid', GRID_DEFAULTS)}
              >
                {labelId => (
                  <input
                    type="checkbox"
                    aria-labelledby={labelId}
                    checked={draft.grid.autoMinimize}
                    onChange={e => stage(
                      'grid', { autoMinimize: e.target.checked }
                    )}
                    className={CHECKBOX_CLASS}
                  />
                )}
              </Field>
            )}
            {section === 'patterns' && (
              <Field
                label="Click beside the pattern chooser to close it"
                onReset={() => stage('patterns', PATTERNS_DEFAULTS)}
              >
                {labelId => (
                  <input
                    type="checkbox"
                    aria-labelledby={labelId}
                    checked={draft.patterns.chooserClickAway}
                    onChange={e => stage(
                      'patterns', { chooserClickAway: e.target.checked }
                    )}
                    className={CHECKBOX_CLASS}
                  />
                )}
              </Field>
            )}
            {section === 'midi' && (
              <MidiFields
                draft={draft.midi}
                stage={partial => stage('midi', partial)}
              />
            )}
            </div>
          </section>
        </div>

        {/* OK / Cancel / Apply */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              apply();
              onClose();
            }}
            className="ss-key ss-cap h-9 px-5 rounded-md text-sm"
          >
            OK
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ss-key ss-cap h-9 px-5 rounded-md text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!dirty}
            className="ss-key ss-cap h-9 px-5 rounded-md text-sm disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ── One field row ───────────────────────────── */

/**
 * A row: label on the left, control on the right.
 * Double-clicking the label (long-press on touch)
 * resets the field. The control gets the label's id
 * for aria-labelledby, so clicks on the label never
 * reach it.
 */
function Field({
  label,
  onReset,
  children,
}: {
  label: string;
  onReset: () => void;
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();
  const longPress = useLongPress(
    () => {
      navigator.vibrate?.(10);
      onReset();
    },
    {
      detect: LongPressEventType.Touch,
      threshold: LONG_PRESS_MS,
      cancelOnMovement: LONG_PRESS_CANCEL_PX,
    }
  );
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-line last:border-b-0">
      <Tooltip tooltipKey="settingReset" position="top">
        {/* A pointer shortcut; the control itself stays
            fully keyboard operable. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <span
          onDoubleClick={onReset}
          {...longPress()}
          className="text-sm select-none cursor-default [-webkit-touch-callout:none]"
        >
          <span id={labelId}>{label}</span>
        </span>
      </Tooltip>
      <div className="shrink-0">{children(labelId)}</div>
    </div>
  );
}

/* ── MIDI ────────────────────────────────────── */

function MidiFields({
  draft,
  stage,
}: {
  draft: MidiConfig;
  stage: (partial: Partial<MidiConfig>) => void;
}) {
  const midi = useMidi();
  if (!midi) return null;
  const { available, initialized, outputs, requestAccess } = midi;
  const defaults = defaultMidiConfig();

  const disabled = !available;
  const statusMsg = initialized && !available
    ? 'MIDI not available in this browser'
    : available && outputs.length === 0
      ? 'No MIDI devices detected'
      : null;

  const enable = async (on: boolean) => {
    stage({ enabled: on });
    // Turning it on asks for MIDI access, so the device
    // list fills in before OK or Apply.
    if (on && !(await requestAccess())) stage({ enabled: false });
  };

  return (
    <>
      {statusMsg && (
        <p className="text-sm text-lcd mb-2">
          {statusMsg}
        </p>
      )}
      <Field
        label="MIDI output"
        onReset={() => stage({ enabled: defaults.enabled })}
      >
        {labelId => (
          <input
            type="checkbox"
            aria-labelledby={labelId}
            checked={draft.enabled}
            disabled={initialized && !available}
            onChange={e => void enable(e.target.checked)}
            className={CHECKBOX_CLASS}
          />
        )}
      </Field>
      <Field
        label="Device"
        onReset={() => stage({ deviceId: defaults.deviceId })}
      >
        {labelId => (
          <LcdSelect
            aria-labelledby={labelId}
            value={draft.deviceId ?? ''}
            options={[
              {
                value: '',
                label: outputs.length === 0
                  ? 'No devices'
                  : 'Select device…',
              },
              ...outputs.map(o => ({
                value: o.id,
                label: o.name || o.id,
              })),
            ]}
            disabled={disabled || outputs.length === 0}
            onChange={deviceId => stage({ deviceId: deviceId || null })}
            className="w-[200px] max-w-full h-9"
          />
        )}
      </Field>
      <Field
        label="Channel"
        onReset={() => stage({ channel: defaults.channel })}
      >
        {labelId => (
          <input
            type="number"
            min={1}
            max={16}
            value={draft.channel}
            disabled={disabled}
            onChange={e => stage({
              channel: Math.max(
                1, Math.min(16, parseInt(e.target.value) || 1)
              ),
            })}
            aria-labelledby={labelId}
            className={`w-20 ${NUMBER_FIELD_CLASS}`}
          />
        )}
      </Field>
      <Field
        label="Note length"
        onReset={() => stage({ noteLength: defaults.noteLength })}
      >
        {labelId => (
          <LcdSelect
            aria-labelledby={labelId}
            value={noteLengthKey(draft.noteLength)}
            options={NOTE_LENGTH_SELECT_OPTIONS}
            disabled={disabled}
            onChange={key => {
              const opt = NOTE_LENGTH_OPTIONS.find(
                o => noteLengthKey(o.value) === key
              );
              if (opt) stage({ noteLength: opt.value });
            }}
            className="w-[200px] max-w-full h-9"
          />
        )}
      </Field>
      <h4 className="ss-label mt-4 mb-1">
        Track notes (MIDI note 0-127)
      </h4>
      <div className="sm:grid sm:grid-cols-2 sm:gap-x-6">
      {TRACKS.map(track => {
        const id = track.id as MidiTrackId;
        const setNote = (noteNumber: number) => stage({
          tracks: { ...draft.tracks, [id]: { noteNumber } },
        });
        return (
          <Field
            key={id}
            label={trackLabel(id)}
            onReset={() => setNote(defaults.tracks[id].noteNumber)}
          >
            {labelId => (
              <input
                type="number"
                min={0}
                max={127}
                aria-labelledby={labelId}
                value={draft.tracks[id]?.noteNumber ?? 0}
                disabled={disabled}
                onChange={e => setNote(Math.max(
                  0, Math.min(127, parseInt(e.target.value) || 0)
                ))}
                className={`w-16 text-center ${NUMBER_FIELD_CLASS}`}
              />
            )}
          </Field>
        );
      })}
      </div>
    </>
  );
}
