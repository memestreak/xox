"use client";

import { memo } from 'react';
import Tooltip from './Tooltip';

/** Page navigation state, owned by `Sequencer`. */
export interface PageNav {
  currentPage: number;
  pageCount: number;
  autoFollow: boolean;
  setPage: (page: number) => void;
  setAutoFollow: (value: boolean) => void;
}

type FollowToggleProps = Pick<
  PageNav, 'autoFollow' | 'setAutoFollow'
>;

/**
 * The "Follow" key: toggles whether the visible page
 * auto-follows the playhead.
 */
function FollowToggleInner({
  autoFollow,
  setAutoFollow,
}: FollowToggleProps) {
  return (
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
  );
}

type PageLightsProps = Pick<
  PageNav, 'currentPage' | 'pageCount' | 'setPage'
>;

/**
 * One light per 16-step page; clicking a light shows
 * that page. Renders nothing for a single page.
 */
function PageLightsInner({
  currentPage,
  pageCount,
  setPage,
}: PageLightsProps) {
  // Page lights only matter past 16 steps.
  if (pageCount <= 1) return null;
  return (
    <div className="flex gap-1.5">
      {Array.from(
        { length: pageCount },
        (_, i) => (
          // Top: below would cover the Follow key.
          <Tooltip key={i} tooltipKey="page" position="top">
            <button
              aria-label={`Page ${i + 1}`}
              aria-current={i === currentPage ? 'true' : undefined}
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
  );
}

export const FollowToggle = memo(FollowToggleInner);
export const PageLights = memo(PageLightsInner);
