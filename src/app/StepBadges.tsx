/**
 * Visual badge overlays for step buttons.
 * Each component is a small absolutely-positioned
 * indicator rendered inside the StepButton.
 */

interface ProbabilityBarProps {
  probability: number;
}

export function ProbabilityBar({
  probability,
}: ProbabilityBarProps) {
  return (
    <span
      data-testid="prob-bar"
      className="absolute bottom-0 left-0 h-[2px]"
      style={{
        width: `${probability}%`,
        background: 'currentColor',
      }}
    />
  );
}

interface PanIndicatorProps {
  panLock: number;
}

export function PanIndicator({
  panLock,
}: PanIndicatorProps) {
  if (panLock === 0.5) {
    return (
      <span
        data-testid="pan-bar"
        className="absolute top-0 h-[2px]"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          width: '2px',
          background: 'currentColor',
        }}
      />
    );
  }
  return (
    <span
      data-testid="pan-bar"
      className="absolute top-0 h-[2px]"
      style={{
        ...(panLock < 0.5
          ? {
            right: '50%',
            width: `${(0.5 - panLock) * 100}%`,
          }
          : {
            left: '50%',
            width: `${(panLock - 0.5) * 100}%`,
          }),
        background: 'currentColor',
      }}
    />
  );
}

interface FillBadgeProps {
  fill: 'fill' | '!fill';
}

export function FillBadge({ fill }: FillBadgeProps) {
  return (
    <span
      data-testid="fill-badge"
      className={
        'absolute top-0.5 right-1'
        + ' text-[10px] font-bold'
        + ' leading-none'
        + ' pointer-events-none'
      }
      style={{
        fontFamily: 'var(--font-barlow-condensed)',
      }}
    >
      {fill === 'fill' ? 'F' : '!F'}
    </span>
  );
}

interface CycleBadgeProps {
  a: number;
  b: number;
}

export function CycleBadge({
  a, b,
}: CycleBadgeProps) {
  return (
    <span
      className={
        'absolute inset-0 flex items-center'
        + ' justify-center text-[15px]'
        + ' font-bold leading-none'
        + ' pointer-events-none'
      }
      style={{
        fontFamily: 'var(--font-barlow-condensed)',
        letterSpacing: '0.05em',
      }}
    >
      {a}:{b}
    </span>
  );
}

interface RetrigBadgeProps {
  count: number;
  variant: string | null;
  /** Variant C with Retrig mode on: big count. */
  editing?: boolean;
}

/**
 * MOCK ONLY: shows a step's retrig count.
 * A: a row of N dots near the bottom.
 * B: the key split into N slices.
 * C: a small ×N in the corner; big N in Retrig mode.
 */
export function RetrigBadge({
  count, variant, editing,
}: RetrigBadgeProps) {
  if (variant === 'C' && editing) {
    return (
      <span
        className={
          'absolute inset-0 flex items-center justify-center'
          + ' text-[17px] font-bold leading-none pointer-events-none'
          + (count === 1 ? ' opacity-35' : '')
        }
        style={{ fontFamily: 'var(--font-barlow-condensed)' }}
      >
        {count === 1 ? '·' : `×${count}`}
      </span>
    );
  }
  if (count < 2) return null;
  if (variant === 'A') {
    return (
      <span
        data-testid="retrig-dots"
        className="absolute left-0 right-0 bottom-[5px] flex justify-center gap-[2px] pointer-events-none"
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="w-[3px] h-[3px] rounded-full"
            style={{ background: 'currentColor' }}
          />
        ))}
      </span>
    );
  }
  if (variant === 'B') {
    return (
      <span className="absolute inset-0 pointer-events-none">
        {Array.from({ length: count - 1 }, (_, i) => (
          <span
            key={i}
            className="absolute top-[11px] bottom-[4px] w-px"
            style={{
              left: `${((i + 1) / count) * 100}%`,
              background: 'currentColor',
              opacity: 0.45,
            }}
          />
        ))}
      </span>
    );
  }
  if (variant === 'C') {
    return (
      <span
        className="absolute bottom-[3px] left-1 text-[10px] font-bold leading-none pointer-events-none"
        style={{ fontFamily: 'var(--font-barlow-condensed)' }}
      >
        ×{count}
      </span>
    );
  }
  return null;
}
