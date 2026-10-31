"use client";

import LcdSelect from './LcdSelect';
import {
  DEFAULT_RETRIG, RETRIG_LENGTHS, RETRIG_RATES,
  type Retrig,
} from './retrig';

/**
 * The Retrig section of the step editor: an Off/On
 * switch, then Rate and Length as note values. Turning
 * it off keeps the rate and length.
 */

const RATE_OPTIONS = RETRIG_RATES.map(r => ({
  value: String(r), label: `1/${r}`,
}));

const LENGTH_OPTIONS = RETRIG_LENGTHS.map(([v, label]) => ({
  value: String(v), label,
}));

interface RetrigEditorProps {
  value: Retrig | undefined;
  onChange: (v: Retrig) => void;
}

export default function RetrigEditor({
  value, onChange,
}: RetrigEditorProps) {
  const r = value ?? { ...DEFAULT_RETRIG, enabled: false };
  const set = (patch: Partial<Retrig>) => onChange({ ...r, ...patch });
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="ss-label text-ink">Retrig</div>
        <div
          className="flex gap-0.5 p-0.5 w-28 rounded-md bg-well border border-line"
          role="radiogroup"
          aria-label="Retrig"
        >
          {([['off', 'Off'], ['on', 'On']] as const).map(([v, text]) => {
            const on = (v === 'on') === r.enabled;
            return (
              <button
                key={v}
                role="radio"
                aria-checked={on}
                onClick={() => set({ enabled: v === 'on' })}
                className={
                  'ss-cap flex-1 h-7 rounded text-xs tracking-[0.1em]'
                  + ' transition-colors focus-visible:outline-2'
                  + ' focus-visible:outline-accent'
                  + (on
                    ? v === 'off'
                      ? ' bg-linear-to-b from-[#34302b] to-[#2a2723] text-ink'
                        + ' shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
                      : ' bg-accent text-[#1a0d05]'
                    : ' text-muted hover:text-ink')
                }
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className={
          'grid grid-cols-2 gap-3'
          + (r.enabled ? '' : ' opacity-40')
        }
      >
        <div className="space-y-1.5 min-w-0">
          <div className="ss-label">Rate</div>
          <LcdSelect
            aria-label="Retrig rate"
            value={String(r.rate)}
            options={RATE_OPTIONS}
            disabled={!r.enabled}
            onChange={v => set({ rate: Number(v) })}
            className="w-full h-8"
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <div className="ss-label">Length</div>
          <LcdSelect
            aria-label="Retrig length"
            value={String(r.length)}
            options={LENGTH_OPTIONS}
            disabled={!r.enabled}
            onChange={v => set({ length: Number(v) })}
            className="w-full h-8"
          />
        </div>
      </div>
    </>
  );
}
