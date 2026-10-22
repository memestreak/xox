import RangeSlider from './RangeSlider';
import PanSlider from './PanSlider';

interface GainLockEditorProps {
  value: number;
  onChange: (v: number) => void;
}

export function GainLockEditor({
  value,
  onChange,
}: GainLockEditorProps) {
  return (
    <div className="space-y-1.5">
      <div className="ss-label">
        Gain
      </div>
      <RangeSlider
        value={value}
        min={0}
        max={100}
        onChange={onChange}
        label="Gain"
      />
    </div>
  );
}

interface PanLockEditorProps {
  value: number;
  onChange: (v: number) => void;
}

export function PanLockEditor({
  value,
  onChange,
}: PanLockEditorProps) {
  return (
    <div className="space-y-1.5">
      <div className="ss-label">
        Pan
      </div>
      <PanSlider
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
