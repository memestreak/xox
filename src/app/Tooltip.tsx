"use client";

import {
  cloneElement, useId,
} from 'react';
import type { ReactElement } from 'react';
import tooltips from './data/tooltips.json';
import { useTooltips } from './TooltipContext';

type TooltipKey = keyof typeof tooltips;

interface TooltipProps {
  tooltipKey: string;
  position?: 'top' | 'bottom';
  children: ReactElement<
    Record<string, unknown>
  >;
}

export default function Tooltip({
  tooltipKey,
  position = 'top',
  children,
}: TooltipProps) {
  const id = useId();
  const { tooltipsEnabled } = useTooltips();

  const text =
    tooltips[tooltipKey as TooltipKey] as
      string | undefined;

  if (!text || !tooltipsEnabled) {
    return children;
  }

  const posClass = position === 'bottom'
    ? 'top-full mt-1'
    : 'bottom-full mb-1';

  return (
    <div className="group/tooltip relative inline-flex">
      {cloneElement(children, {
        'aria-describedby': id,
      })}
      <span
        id={id}
        role="tooltip"
        className={
          'pointer-events-none absolute'
          + ' left-1/2 -translate-x-1/2'
          + ' ' + posClass
          + ' z-50 whitespace-nowrap'
          + ' px-1.5 py-0.5'
          + ' text-[10px] font-bold'
          + ' bg-neutral-800 text-neutral-200'
          + ' rounded'
          + ' opacity-0'
          + ' group-hover/tooltip:opacity-100'
          + ' transition-opacity'
          + ' [transition-delay:0ms]'
          + ' group-hover/tooltip:'
          + '[transition-delay:750ms]'
        }
      >
        {text}
      </span>
    </div>
  );
}
