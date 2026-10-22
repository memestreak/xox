"use client";

import { memo } from 'react';
import Tooltip from './Tooltip';

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
    <div className="flex items-center gap-2 flex-shrink-0">
      <Tooltip tooltipKey="follow" position="bottom">
        <button
          aria-label="Auto-follow playhead"
          aria-pressed={autoFollow}
          onClick={() => setAutoFollow(!autoFollow)}
          className={
            'ss-key ss-cap h-9 px-2.5 text-xs'
            + ' inline-flex items-center gap-1.5'
            + ' whitespace-nowrap'
            + (autoFollow ? ' text-ink' : ' text-muted')
          }
        >
          <span
            className={
              'ss-led' + (autoFollow ? ' ss-led-on' : '')
            }
          />
          Follow
        </button>
      </Tooltip>
      {/* Page dots only matter past 16 steps. */}
      {pageCount > 1 && (
      <div className="flex gap-1.5">
        {Array.from(
          { length: pageCount },
          (_, i) => (
            <Tooltip key={i} tooltipKey="page" position="bottom">
              <button
                aria-label={`Page ${i + 1}`}
                onClick={() => setPage(i)}
                className={
                  'w-2.5 h-2.5 rounded-full'
                  + ' transition-colors'
                  + ' focus-visible:outline-2'
                  + ' focus-visible:outline-offset-2'
                  + ' focus-visible:outline-accent '
                  + (i === currentPage
                    ? 'bg-accent'
                      + ' shadow-[0_0_8px_rgb(240_102_42/0.6)]'
                    : 'bg-edge hover:bg-faint')
                }
              />
            </Tooltip>
          )
        )}
      </div>
      )}
    </div>
  );
}

const PageIndicator = memo(PageIndicatorInner);
export default PageIndicator;
