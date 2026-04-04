import ProbabilitySlider from './ProbabilitySlider';

interface ProbabilityEditorProps {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Probability condition editor section.
 */
export default function ProbabilityEditor({
  value,
  onChange,
}: ProbabilityEditorProps) {
  return (
    <div className="space-y-1">
      <div className={
        'text-[10px] uppercase tracking-wider'
        + ' text-neutral-500'
      }>
        Probability
      </div>
      <ProbabilitySlider
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
