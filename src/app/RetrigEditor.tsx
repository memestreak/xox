"use client";

import {
  DEFAULT_RETRIG, RETRIG_LENGTHS, RETRIG_RATES,
  type Retrig,
} from './retrig';

/**
 * MOCK ONLY: the Retrig section of the step editor:
 * an on/off switch, then Rate, Length and Ramp.
 */

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
  disabled?: boolean;
  /** Light the first option orange too (e.g. On/Off). */
  plain?: boolean;
}

function Segmented<T extends string | number>({
  label, value, options, onChange, disabled, plain,
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
            'ss-cap flex-1 h-7 px-0.5 rounded text-xs whitespace-nowrap'
            + ' tracking-[0.04em] transition-colors'
            + ' focus-visible:outline-2'
            + ' focus-visible:outline-accent'
            + (value === val
              ? i === 0 && !plain
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

const RATE_OPTIONS = RETRIG_RATES.map(
  r => [r, `1/${r}`] as const
);

const RAMPS = [
  ['flat', 'Flat'], ['in', 'Fade in'], ['out', 'Fade out'],
] as const;

interface RetrigEditorProps {
  value: Retrig | undefined;
  onChange: (v: Retrig) => void;
}

export function RetrigEditor({
  value, onChange,
}: RetrigEditorProps) {
  const r = value ?? { ...DEFAULT_RETRIG, enabled: false };
  const off = !r.enabled;
  const set = (patch: Partial<Retrig>) => {
    const next = { ...r, ...patch };
    if (next.ramp === undefined) delete next.ramp;
    onChange(next);
  };
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="ss-label text-ink">Retrig</div>
        <div className="w-28">
          <Segmented
            label="Retrig"
            value={r.enabled ? 'on' : 'off'}
            options={[['off', 'Off'], ['on', 'On']] as const}
            onChange={v => set({ enabled: v === 'on' })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="ss-label">Rate · time between hits</div>
        <Segmented
          label="Retrig rate"
          value={r.rate}
          options={RATE_OPTIONS}
          disabled={off}
          plain
          onChange={rate => set({ rate })}
        />
      </div>
      <div className="space-y-1.5">
        <div className="ss-label">Length · how long it rolls</div>
        <Segmented
          label="Retrig length"
          value={r.length}
          options={RETRIG_LENGTHS}
          disabled={off}
          plain
          onChange={length => set({ length })}
        />
      </div>
      <div className="space-y-1.5">
        <div className="ss-label">Ramp</div>
        <Segmented
          label="Retrig ramp"
          value={r.ramp ?? 'flat'}
          options={RAMPS}
          disabled={off}
          onChange={v => set({ ramp: v === 'flat' ? undefined : v })}
        />
      </div>
    </>
  );
}
