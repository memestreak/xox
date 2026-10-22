import type { ReactNode } from 'react';

interface PanelSectionProps {
  /** Silkscreen label printed above the controls. */
  label?: string;
  /** Id of the control the label names, if any. */
  labelFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * One labelled cell of the global controls strip.
 * The strip's background shows through the 1px gaps
 * between cells as hairline dividers.
 */
export default function PanelSection({
  label,
  labelFor,
  className = '',
  children,
}: PanelSectionProps) {
  return (
    <div
      className={
        'bg-panel px-3 pt-2.5 pb-3 lg:px-4'
        + ' flex flex-col gap-2 min-w-0 '
        + className
      }
    >
      {label && (labelFor ? (
        <label htmlFor={labelFor} className="ss-label">
          {label}
        </label>
      ) : (
        <span className="ss-label">{label}</span>
      ))}
      {children}
    </div>
  );
}
