"use client";

import { memo } from 'react';

interface PageIndicatorProps {
  currentPage: number;
  pageCount: number;
  autoFollow: boolean;
  setPage: (page: number) => void;
  setAutoFollow: (value: boolean) => void;
}

/**
 * Page navigation dots with auto-follow toggle.
 * Shows one dot per page; clicking a dot switches
 * the visible page. The "F" button toggles whether
 * the page auto-follows the playhead.
 */
function PageIndicatorInner({
  currentPage,
  pageCount,
  autoFollow,
  setPage,
  setAutoFollow,
}: PageIndicatorProps) {
  return (
    <div
      className={
        'flex flex-col items-start gap-1.5'
        + ' flex-shrink-0'
      }
    >
      <button
        aria-label="Auto-follow playhead"
        aria-pressed={autoFollow}
        onClick={() => setAutoFollow(!autoFollow)}
        className={
          'px-2.5 py-px rounded-full'
          + ' text-[10px] lg:text-xs'
          + ' whitespace-nowrap'
          + ' font-bold transition-colors'
          + ' focus-visible:outline-none'
          + ' focus-visible:ring-2'
          + ' focus-visible:ring-orange-500 '
          + (autoFollow
            ? 'bg-orange-600 text-white'
            : 'bg-neutral-800'
              + ' border border-neutral-600'
              + ' text-neutral-500')
        }
      >
        Follow
      </button>
      <div className="flex gap-1.5 self-center">
        {Array.from(
          { length: pageCount },
          (_, i) => (
            <button
              key={i}
              aria-label={`Page ${i + 1}`}
              onClick={() => setPage(i)}
              className={
                'w-2.5 h-2.5 rounded-full'
                + ' transition-colors'
                + ' focus-visible:outline-none'
                + ' focus-visible:ring-2'
                + ' focus-visible:ring-orange-500 '
                + (i === currentPage
                  ? 'bg-orange-500'
                    + ' shadow-[0_0_8px_rgba('
                    + '249,115,22,0.6)]'
                  : 'bg-neutral-600'
                    + ' hover:bg-neutral-400')
              }
            />
          )
        )}
      </div>
    </div>
  );
}

const PageIndicator = memo(PageIndicatorInner);
export default PageIndicator;
