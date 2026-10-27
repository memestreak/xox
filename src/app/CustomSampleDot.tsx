interface CustomSampleDotProps {
  /** Original file name, shown on hover. */
  fileName: string;
  /** Positioning classes from the parent. */
  className?: string;
}

/**
 * Small amber dot marking a track that plays a sample
 * loaded from a file. A 12px box keeps it easy to hover.
 */
export default function CustomSampleDot({
  fileName,
  className = '',
}: CustomSampleDotProps) {
  return (
    <span
      role="img"
      aria-label={`Custom sample: ${fileName}`}
      title={fileName}
      className={
        'flex items-center justify-center w-3 h-3 shrink-0 '
        + className
      }
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full bg-accent"
      />
    </span>
  );
}
