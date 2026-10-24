"use client";

import { memo, useCallback } from 'react';
import Knob from './Knob';
import PanelSection from './PanelSection';
import { useSequencer } from './SequencerContext';
import Tooltip from './Tooltip';
import { getPatternLength } from './types';
import { FollowToggle, PageLights } from './PageIndicator';
import type { PageNav } from './PageIndicator';

interface GlobalControlsProps {
  page: PageNav;
}

/**
 * Global controls: pattern length with page lights
 * and Follow, swing, and reset. Renders three cells
 * of the controls strip; the parent places them
 * after Pattern change on desktop (Reset last).
 */
function GlobalControlsInner({ page }: GlobalControlsProps) {
  const { state, actions, meta } = useSequencer();
  const patternLength = getPatternLength(meta.config.tracks);

  const handlePatternLength = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      actions.setPatternLength(
        parseInt(e.target.value, 10)
      );
    },
    [actions]
  );

  const handleSwing = useCallback(
    (v: number) => {
      actions.setSwing(Math.round(v * 100));
    },
    [actions]
  );

  const handleReset = useCallback(() => {
    actions.clearAll();
    actions.setPatternLength(16);
    actions.setSwing(0);
  }, [actions]);

  return (
    <>
      {/* Below lg: Steps and Swing share row 1. The
          page lights sit on the label line, centered
          over Follow, so the cell never changes width
          as pages come and go. */}
      <PanelSection className="col-span-4 max-lg:order-1 max-lg:rounded-tl-[11px]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[76px_auto] items-center gap-x-1.5 lg:gap-x-2 gap-y-2">
          <label htmlFor="global-steps" className="ss-label">
            Steps
          </label>
          <div className="flex justify-center">
            <PageLights
              currentPage={page.currentPage}
              pageCount={page.pageCount}
              setPage={page.setPage}
            />
          </div>
          <Tooltip tooltipKey="steps" position="bottom">
            <select
              id="global-steps"
              value={patternLength}
              onChange={handlePatternLength}
              className="ss-key ss-select h-9 w-full pl-3 font-mono text-sm"
            >
              {Array.from(
                { length: 64 },
                (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                )
              )}
            </select>
          </Tooltip>
          <FollowToggle
            autoFollow={page.autoFollow}
            setAutoFollow={page.setAutoFollow}
          />
        </div>
      </PanelSection>

      <PanelSection label="Swing" className="col-span-2 max-lg:order-1 max-lg:rounded-tr-[11px]">
        <div className="flex items-center gap-2.5 h-9">
          <Tooltip tooltipKey="swing" position="bottom">
            <Knob
              value={state.swing / 100}
              onChange={handleSwing}
              size={34}
              ariaPrefix="Swing"
              defaultValue={0}
              showHoverValue={false}
            />
          </Tooltip>
          <span className="font-mono text-sm text-ink w-9 tabular-nums">
            {state.swing}%
          </span>
        </div>
      </PanelSection>

      <PanelSection className="col-span-2 justify-end max-lg:order-3 lg:order-last lg:rounded-r-[11px]">
        <Tooltip
          tooltipKey="reset"
          position="bottom"
          align="right"
        >
          <button
            onClick={handleReset}
            className="ss-key ss-cap h-9 px-3 text-xs text-muted hover:text-step1"
          >
            Reset
          </button>
        </Tooltip>
      </PanelSection>
    </>
  );
}

const GlobalControls = memo(GlobalControlsInner);
export default GlobalControls;
