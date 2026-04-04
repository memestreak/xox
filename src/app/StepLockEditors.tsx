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
    <div className="space-y-1">
      <div className={
        'text-[10px] uppercase tracking-wider'
        + ' text-neutral-500'
      }>
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
    <div className="space-y-1">
      <div className={
        'text-[10px] uppercase tracking-wider'
        + ' text-neutral-500'
      }>
        Pan
      </div>
      <PanSlider
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
