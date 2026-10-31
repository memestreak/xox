"use client";

import Knob from './Knob';
import {
  DEFAULT_RETRIG, RETRIG_LENGTHS, RETRIG_RATES,
  type Retrig,
} from './retrig';

/**
 * The Retrig section of the step editor: an Off/On
 * switch, then Rate and Length dials in note values.
 * Double-click a dial or its value to reset it. Turning
 * retrig off keeps the rate and length.
 */

const RATE_LABELS = RETRIG_RATES.map(r => `1/${r}`);
const LENGTH_LABELS = RETRIG_LENGTHS.map(([, label]) => label);
const LENGTH_STEPS = RETRIG_LENGTHS.map(([steps]) => steps);

interface DialProps {
  label: string;
  /** Option labels, slowest/shortest first. */
  labels: readonly string[];
  index: number;
  defaultIndex: number;
  onChange: (index: number) => void;
}

/** A stepped knob over a list of options, with its value. */
function Dial({
  label, labels, index, defaultIndex, onChange,
}: DialProps) {
  const last = labels.length - 1;
  const toIndex = (v: number) =>
    Math.max(0, Math.min(last, Math.round(v * last)));
  return (
    <div className="flex items-center gap-2.5">
      <Knob
        value={index / last}
        onChange={v => onChange(toIndex(v))}
        steps={labels.length}
        size={40}
        defaultValue={defaultIndex / last}
        formatValue={v => labels[toIndex(v)]}
        ariaPrefix={`Retrig ${label.toLowerCase()}`}
        showHoverValue={false}
      />
      <div className="flex flex-col items-start gap-0.5">
        <span className="ss-label">{label}</span>
        <button
          type="button"
          aria-label={
            `${label} ${labels[index]}. Double-click to reset`
            + ` to ${labels[defaultIndex]}`
          }
          onDoubleClick={() => onChange(defaultIndex)}
          className="font-mono text-sm leading-none text-ink cursor-default select-none"
        >
          {labels[index]}
        </button>
      </div>
    </div>
  );
}

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
      {/* Off: the dials keep their values but can't be used */}
      <div
        inert={!r.enabled}
        className={
          'grid grid-cols-2 gap-3'
          + (r.enabled ? '' : ' opacity-40')
        }
      >
        <Dial
          label="Rate"
          labels={RATE_LABELS}
          index={RETRIG_RATES.indexOf(r.rate)}
          defaultIndex={RETRIG_RATES.indexOf(DEFAULT_RETRIG.rate)}
          onChange={i => set({ rate: RETRIG_RATES[i] })}
        />
        <Dial
          label="Length"
          labels={LENGTH_LABELS}
          index={LENGTH_STEPS.indexOf(r.length)}
          defaultIndex={LENGTH_STEPS.indexOf(DEFAULT_RETRIG.length)}
          onChange={i => set({ length: LENGTH_STEPS[i] })}
        />
      </div>
    </>
  );
}
