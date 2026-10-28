interface CustomSampleDotProps {
  /** Original file name, shown on hover. */
  fileName: string;
  /** True while the track plays the custom sample. */
  isOn: boolean;
  /** Switches between the custom and kit sample. */
  onToggle?: () => void;
  /** Positioning classes from the parent. */
  className?: string;
}

/** Hover text for the dot: the status, then what a click does. */
export function customSampleTitle(
  fileName: string, isOn: boolean
): string {
  return isOn
    ? `Custom sample on: ${fileName}. Click to use the kit sample.`
    : `Custom sample off: ${fileName}. Click to use it again.`;
}

/**
 * Small amber dot marking a track with a sample loaded
 * from a file: solid while it plays, hollow while the
 * track is back on the kit sample. Clicking it toggles
 * between the two. A 12px box keeps it easy to hit.
 */
export default function CustomSampleDot({
  fileName,
  isOn,
  onToggle,
  className = '',
}: CustomSampleDotProps) {
  return (
    <button
      type="button"
      aria-label={`Custom sample: ${fileName}`}
      aria-pressed={isOn}
      title={customSampleTitle(fileName, isOn)}
      // Keep the press off the row: no preview, no drag.
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onClick={e => {
        e.stopPropagation();
        onToggle?.();
      }}
      className={
        'flex items-center justify-center w-3 h-3 shrink-0'
        + ' rounded-full cursor-pointer'
        + ' focus-visible:outline-2 focus-visible:outline-accent '
        + className
      }
    >
      <span
        aria-hidden="true"
        className={
          'w-1.5 h-1.5 rounded-full border border-accent'
          + (isOn ? ' bg-accent' : ' bg-transparent')
        }
      />
    </button>
  );
}
