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
    <div className="space-y-1.5">
      <div className="ss-label">
        Cycle
      </div>
      <select
        aria-label="Cycle"
        value={value}
        onChange={handleChange}
        className="ss-key ss-select w-full h-8 pl-2.5 font-mono text-sm"
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
