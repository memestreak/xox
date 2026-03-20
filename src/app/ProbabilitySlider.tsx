"use client";

import RangeSlider from './RangeSlider';

interface ProbabilitySliderProps {
  value: number;
  onChange: (v: number) => void;
}

/**
 * Probability slider (1-100). Thin wrapper around
 * RangeSlider.
 */
export default function ProbabilitySlider({
  value,
  onChange,
}: ProbabilitySliderProps) {
  return (
    <RangeSlider
      value={value}
      min={1}
      max={100}
      onChange={onChange}
      label="Probability"
    />
  );
}
