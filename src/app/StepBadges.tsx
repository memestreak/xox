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
