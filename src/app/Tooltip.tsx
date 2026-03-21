"use client";

import {
  cloneElement, useId,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import tooltips from './data/tooltips.json';
import { useTooltips } from './TooltipContext';

type TooltipKey = keyof typeof tooltips;

interface TooltipProps {
  tooltipKey: string;
  position?: 'top' | 'bottom';
  align?: 'center' | 'right';
  children: ReactElement<
    Record<string, unknown>
  >;
}

export default function Tooltip({
  tooltipKey,
  position = 'top',
  align = 'center',
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

  const existingClass =
    (children.props as { className?: string })
      .className ?? '';

  const tooltipSpan = (
    <span
      key="__tooltip"
      id={id}
      role="tooltip"
      className={
        'pointer-events-none absolute'
        + (align === 'right'
          ? ' right-0'
          : ' left-1/2 -translate-x-1/2')
        + ' ' + posClass
        + ' z-50 whitespace-nowrap'
        + ' px-1.5 py-0.5'
        + ' text-[10px] font-bold normal-case tracking-normal'
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
  );

  // Native elements that can accept arbitrary children
  // get the tooltip span injected directly — no wrapper
  // div that could break grid/flex layout (e.g. step
  // buttons in the sequencer grid).
  const CONTAINER_TAGS = new Set([
    'button', 'div', 'span', 'a', 'label',
    'li', 'td', 'th', 'section', 'article',
    'nav', 'header', 'footer', 'main', 'aside',
  ]);
  const tag = typeof children.type === 'string'
    ? children.type
    : null;

  if (tag && CONTAINER_TAGS.has(tag)) {
    const existingChildren =
      (children.props as { children?: ReactNode })
        .children;

    const hasPosition = /\b(relative|absolute|fixed|sticky)\b/
      .test(existingClass);

    return cloneElement(children, {
      'aria-describedby': id,
      className: existingClass
        + ' group/tooltip'
        + (hasPosition ? '' : ' relative'),
      children: (
        <>
          {existingChildren}
          {tooltipSpan}
        </>
      ),
    });
  }

  // For everything else (custom components, <select>,
  // <input>, etc.), wrap in a div.
  return (
    <div className="group/tooltip relative">
      {cloneElement(children, {
        'aria-describedby': id,
      })}
      {tooltipSpan}
    </div>
  );
}
