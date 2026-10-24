import { CYCLE_OPTIONS } from './trigConditions';
import LcdSelect from './LcdSelect';

interface CycleEditorProps {
  value: string;
  onChange: (v: string) => void;
}

const OPTIONS = CYCLE_OPTIONS.map(o => ({
  value: o.label,
  label: o.label,
}));

/**
 * Cycle condition editor (a:b dropdown).
 */
export default function CycleEditor({
  value,
  onChange,
}: CycleEditorProps) {
  return (
    <div className="space-y-1.5">
      <div className="ss-label">
        Cycle
      </div>
      <LcdSelect
        aria-label="Cycle"
        value={value}
        options={OPTIONS}
        onChange={onChange}
        className="w-full h-8"
      />
    </div>
  );
}
