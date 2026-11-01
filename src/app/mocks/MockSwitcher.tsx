'use client';

/**
 * The mock switcher
 * (`docs/specs/2026-11-01-mock-switcher-design.md`): a
 * small card pinned bottom right, shown only when the
 * link names one of the declared mocks (`useMock`). Each
 * mock is a row of option keys; pressing one switches the
 * page in place. Its title folds it to one line.
 * Mounted once by `Sequencer`.
 */
import { useState } from 'react';
import { CHOOSER_AREA_ATTR } from '../keyboardUtils';
import {
  chosen, setMock, useShownMocks, type Mock,
} from './useMock';

export function MockSwitcher() {
  const { mocks, search } = useShownMocks();
  const [folded, setFolded] = useState(false);
  if (mocks.length === 0) return null;
  const summary = mocks
    .map(m => optionLabel(m, chosen(m, search)))
    .join(' · ');
  return (
    <aside
      aria-label="Mocks"
      // Pressing an option shouldn't close the pattern
      // chooser as a click beside the column would.
      {...{ [CHOOSER_AREA_ATTR]: '' }}
      className="ss-menu fixed right-3 bottom-3 z-50 flex flex-col gap-1.5 max-w-[calc(100vw-24px)] px-2 pt-1.5 pb-2"
    >
      <button
        type="button"
        aria-expanded={!folded}
        onClick={() => setFolded(f => !f)}
        className="flex items-center gap-2 px-0.5 text-left text-[11px] text-muted hover:text-ink"
      >
        <span className="ss-cap">Mock</span>
        {folded && (
          <span className="text-xs font-medium text-ink">
            {summary}
          </span>
        )}
        <span aria-hidden="true" className="ml-auto">
          {folded ? '▴' : '▾'}
        </span>
      </button>
      {!folded && mocks.map(mock => {
        const current = chosen(mock, search);
        const labelId = `mock-${mock.param}`;
        return (
          <div
            key={mock.param}
            className="flex items-center gap-2"
          >
            <span
              id={labelId}
              className="min-w-[3.5em] text-xs text-muted"
            >
              {mock.label}
            </span>
            <div
              role="group"
              aria-labelledby={labelId}
              className="flex flex-wrap gap-1"
            >
              {mock.options.map(option => {
                const on = option.value === current;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    title={`?${mock.param}=${option.value}`}
                    onClick={() => setMock(mock, option.value)}
                    className={
                      'ss-key h-7 px-2.5 text-xs font-medium'
                      + (on
                        ? ' bg-none bg-accent border-accent-hi text-[#1a0d05]'
                        : ' border-edge text-ink')
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function optionLabel(mock: Mock, value: string): string {
  return mock.options.find(o => o.value === value)?.label
    ?? value;
}
