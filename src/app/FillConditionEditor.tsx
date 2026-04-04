interface FillConditionEditorProps {
  value: 'none' | 'fill' | '!fill';
  onChange: (v: 'none' | 'fill' | '!fill') => void;
}

/**
 * Fill / !Fill radio group editor.
 */
export default function FillConditionEditor({
  value,
  onChange,
}: FillConditionEditorProps) {
  return (
    <div className="space-y-1">
      <div className={
        'text-[10px] uppercase tracking-wider'
        + ' text-neutral-500'
      }>
        Fill
      </div>
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Fill condition"
      >
        {([
          ['none', 'None'],
          ['fill', 'FILL'],
          ['!fill', '!FILL'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            role="radio"
            aria-checked={value === val}
            onClick={() => onChange(val)}
            className={
              'flex-1 text-xs py-1 rounded'
              + ' border transition-colors'
              + (value === val
                ? val === 'fill'
                  ? ' bg-orange-600'
                    + ' border-orange-500'
                    + ' text-white'
                  : val === '!fill'
                    ? ' bg-neutral-700'
                      + ' border-neutral-600'
                      + ' text-neutral-200'
                    : ' bg-neutral-800'
                      + ' border-neutral-600'
                      + ' text-neutral-200'
                : ' bg-neutral-900'
                  + ' border-neutral-700'
                  + ' text-neutral-400'
                  + ' hover:bg-neutral-800')
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
