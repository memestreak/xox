interface FillConditionEditorProps {
  value: 'none' | 'fill' | '!fill';
  onChange: (v: 'none' | 'fill' | '!fill') => void;
}

const OPTIONS = [
  ['none', 'Any'],
  ['fill', 'Fill'],
  ['!fill', '!Fill'],
] as const;

/**
 * Fill condition as a segmented control: play on any
 * pass, only during a fill, or only outside a fill.
 */
export default function FillConditionEditor({
  value,
  onChange,
}: FillConditionEditorProps) {
  return (
    <div className="space-y-1.5">
      <div className="ss-label">Fill</div>
      <div
        className="flex gap-0.5 p-0.5 rounded-md bg-well border border-line"
        role="radiogroup"
        aria-label="Fill condition"
      >
        {OPTIONS.map(([val, label]) => (
          <button
            key={val}
            role="radio"
            aria-checked={value === val}
            onClick={() => onChange(val)}
            className={
              'ss-cap flex-1 h-7 rounded text-xs'
              + ' tracking-[0.1em] transition-colors'
              + ' focus-visible:outline-2'
              + ' focus-visible:outline-accent'
              + (value === val
                ? val === 'none'
                  ? ' bg-linear-to-b from-[#34302b] to-[#2a2723]'
                    + ' text-ink'
                    + ' shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
                  : ' bg-accent text-[#1a0d05]'
                : ' text-muted hover:text-ink')
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
