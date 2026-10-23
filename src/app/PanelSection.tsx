import type { ReactNode } from 'react';

interface PanelSectionProps {
  /** Silkscreen label printed above the controls. */
  label?: string;
  /** Id of the control the label names, if any. */
  labelFor?: string;
  className?: string;
  children: ReactNode;
  /** Mouse handlers for the whole cell, if any. */
  onMouseDown?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
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
  onMouseDown,
  onDoubleClick,
}: PanelSectionProps) {
  return (
    // Mouse handlers here are shortcuts for controls
    // that are keyboard operable on their own.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
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
