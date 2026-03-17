"use client";

import { memo } from 'react';

interface RunningLightProps {
  currentStep: number;
  patternLength: number;
}

/**
 * Playback position indicator. Dot count matches the
 * current pattern length. Uses a unified responsive grid:
 * 2x8 on mobile, 1xN on desktop.
 */
function RunningLightInner({
  currentStep,
  patternLength,
}: RunningLightProps) {
  return (
    <div className="flex gap-4 items-center pt-2">
      <div className="hidden lg:block w-48" />
      <div
        className="flex-1 grid gap-[3px] lg:gap-1.5"
        style={{
          gridTemplateColumns:
            `repeat(${patternLength}, minmax(0, 1fr))`,
        }}
      >
        {Array.from(
          { length: patternLength },
          (_, i) => (
            <div
              key={i}
              className={
                'h-1.5 rounded-full'
                + ' transition-colors duration-100 '
                + (i === currentStep
                  ? 'bg-orange-500'
                    + ' shadow-[0_0_10px_rgba(249,115,22,0.8)]'
                  : 'bg-neutral-900')
              }
            />
          )
        )}
      </div>
    </div>
  );
}

const RunningLight = memo(RunningLightInner);
export default RunningLight;
