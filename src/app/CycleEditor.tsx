import { useCallback } from 'react';
import { CYCLE_OPTIONS } from './trigConditions';

interface CycleEditorProps {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Cycle condition editor (a:b dropdown).
 */
export default function CycleEditor({
  value,
  onChange,
}: CycleEditorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div className="space-y-1">
      <div className={
        'text-[10px] uppercase tracking-wider'
        + ' text-neutral-500'
      }>
        Cycle
      </div>
      <select
        value={value}
        onChange={handleChange}
        className={
          'w-full bg-neutral-800'
          + ' text-neutral-200'
          + ' text-sm rounded px-2 py-1.5'
          + ' border border-neutral-700'
          + ' focus-visible:outline-none'
          + ' focus-visible:ring-2'
          + ' focus-visible:ring-orange-500'
        }
      >
        {CYCLE_OPTIONS.map(opt => (
          <option key={opt.label} value={opt.label}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
