"use client";

import {
  cloneElement, useEffect, useId, useRef,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import tooltips from './data/tooltips.json';
import { interfacePrefs } from './preferences';
import { TOOLTIP_EDGE_MARGIN_PX } from './constants';
import { tooltipShift, visibleBand } from './tooltipFit';

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
  const tooltipsEnabled = interfacePrefs.useValue().showTooltips;
  const tipRef = useRef<HTMLSpanElement>(null);

  // On hover, nudge the tooltip sideways if it would
  // spill past the window or a clipping ancestor (the
  // track area scrolls, so it cuts off anything that
  // pokes out of it). It shows after a delay, so it is
  // laid out, though invisible, when this measures.
  const text =
    tooltips[tooltipKey as TooltipKey] as
      string | undefined;
  const shown = Boolean(text) && tooltipsEnabled;
  useEffect(() => {
    const tip = tipRef.current;
    const host = tip?.parentElement;
    if (!shown || !tip || !host) return;
    const fit = () => {
      tip.style.marginLeft = '';
      const rect = tip.getBoundingClientRect();
      const shift = tooltipShift(
        rect, visibleBand(tip), TOOLTIP_EDGE_MARGIN_PX,
      );
      if (shift !== 0) {
        tip.style.marginLeft = `${shift}px`;
      }
    };
    host.addEventListener('pointerenter', fit);
    return () => {
      host.removeEventListener('pointerenter', fit);
    };
  }, [shown]);

  if (!shown) {
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
      ref={tipRef}
      id={id}
      role="tooltip"
      className={
        'pointer-events-none absolute'
        + (align === 'right'
          ? ' right-0'
          : ' left-1/2 -translate-x-1/2')
        + ' ' + posClass
        + ' z-50 w-max max-w-[calc(100vw-8px)]'
        + ' px-1.5 py-0.5'
        + ' text-xs font-medium normal-case tracking-normal font-sans'
        + ' bg-raised text-ink border border-edge'
        + ' shadow-lg rounded'
        + ' opacity-0'
        + ' group-hover/tooltip:opacity-100'
        + ' transition-opacity'
        + ' delay-0'
        + ' group-hover/tooltip:delay-1000'
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
