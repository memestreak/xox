"use client";

import RangeSlider from './RangeSlider';
import type { StepLocks } from './types';

/**
 * MOCK ONLY: editors for per-step retrig (and, in
 * variant B, the extra glitch effects).
 */

type Retrig = NonNullable<StepLocks['retrig']>;

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
  disabled?: boolean;
}

function Segmented<T extends string | number>({
  label, value, options, onChange, disabled,
}: SegmentedProps<T>) {
  return (
    <div
      className={
        'flex gap-0.5 p-0.5 rounded-md bg-well border border-line'
        + (disabled ? ' opacity-40' : '')
      }
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([val, text], i) => (
        <button
          key={String(val)}
          role="radio"
          aria-checked={value === val}
          disabled={disabled}
          onClick={() => onChange(val)}
          className={
            'ss-cap flex-1 h-7 rounded text-xs'
            + ' tracking-[0.1em] transition-colors'
            + ' focus-visible:outline-2'
            + ' focus-visible:outline-accent'
            + (value === val
              ? i === 0
                ? ' bg-linear-to-b from-[#34302b] to-[#2a2723]'
                  + ' text-ink'
                  + ' shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
                : ' bg-accent text-[#1a0d05]'
              : ' text-muted enabled:hover:text-ink')
          }
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const COUNTS = [
  [1, 'Off'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8'],
] as const;

const RAMPS = [
  ['flat', 'Flat'], ['in', 'Fade in'], ['out', 'Fade out'],
] as const;

interface RetrigEditorProps {
  value: Retrig | undefined;
  onChange: (v: Retrig | undefined) => void;
}

/** Hits per step plus their velocity ramp. */
export function RetrigEditor({
  value, onChange,
}: RetrigEditorProps) {
  const count = value?.count ?? 1;
  const ramp = value?.ramp ?? 'flat';
  return (
    <>
      <div className="space-y-1.5">
        <div className="ss-label">Retrig · hits per step</div>
        <Segmented
          label="Retrig count"
          value={count}
          options={COUNTS}
          onChange={c => onChange(
            c === 1 ? undefined : {
              count: c,
              ...(ramp === 'flat' ? {} : { ramp }),
            }
          )}
        />
      </div>
      <div className="space-y-1.5">
        <div className="ss-label">Ramp</div>
        <Segmented
          label="Retrig ramp"
          value={ramp}
          options={RAMPS}
          disabled={count === 1}
          onChange={r => onChange({
            count,
            ...(r === 'flat' ? {} : { ramp: r }),
          })}
        />
      </div>
    </>
  );
}

interface GlitchExtrasProps {
  locks: StepLocks | undefined;
  onChange: (patch: StepLocks) => void;
}

/** Variant B: chop, reverse and pitch (not played yet). */
export function GlitchExtras({
  locks, onChange,
}: GlitchExtrasProps) {
  return (
    <>
      <div className="space-y-1.5">
        <div className="ss-label">Chop · sample length</div>
        <RangeSlider
          value={locks?.chop ?? 100}
          min={5}
          max={100}
          label="Chop"
          onChange={v => onChange({ chop: v })}
        />
      </div>
      <div className="flex gap-3">
        <div className="space-y-1.5 w-28">
          <div className="ss-label">Reverse</div>
          <Segmented
            label="Reverse"
            value={locks?.reverse ? 'on' : 'off'}
            options={[['off', 'Off'], ['on', 'Rev']] as const}
            onChange={v => onChange({ reverse: v === 'on' })}
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="ss-label">Pitch · semitones</div>
          <Segmented
            label="Pitch"
            value={locks?.pitch ?? 0}
            options={[
              [0, '0'], [-12, '−12'], [-5, '−5'], [5, '+5'], [12, '+12'],
            ] as const}
            onChange={v => onChange({ pitch: v })}
          />
        </div>
      </div>
    </>
  );
}
