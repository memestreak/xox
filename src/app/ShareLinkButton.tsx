"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSequencer } from './SequencerContext';
import { encodeConfig } from './configCodec';
import { FEEDBACK_TIMEOUT_MS } from './constants';
import Tooltip from './Tooltip';

/**
 * Copy share link key (beside the Swing knob). Encodes
 * the current config as a URL hash and copies the full
 * URL to the clipboard. A short note below the key says
 * whether it worked; custom samples aren't in links.
 */
export default function ShareLinkButton() {
  const { state, meta } = useSequencer();
  const [feedback, setFeedback] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(
    undefined
  );
  const hasCustomSamples =
    Object.keys(state.customSamples).length > 0;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const showFeedback = useCallback((text: string) => {
    setFeedback(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => setFeedback(''), FEEDBACK_TIMEOUT_MS
    );
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const hash = await encodeConfig(meta.config);
      const url =
        window.location.origin +
        window.location.pathname +
        '#' +
        hash;
      await navigator.clipboard.writeText(url);
      showFeedback(hasCustomSamples
        ? "Copied! Custom samples aren't included."
        : 'Copied!');
    } catch {
      showFeedback('Copy failed');
    }
  }, [meta.config, hasCustomSamples, showFeedback]);

  return (
    <div className="relative">
      <Tooltip tooltipKey="share" position="bottom" align="right">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy share link"
          className="ss-key w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-ink"
        >
          {feedback && feedback !== 'Copy failed' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
          )}
        </button>
      </Tooltip>
      {/* Always mounted so screen readers hear the change. */}
      <span
        role="status"
        className={feedback
          ? 'ss-menu absolute right-0 top-full mt-2 z-30'
            + ' px-2.5 py-1.5 text-xs text-ink whitespace-nowrap'
            + ' pointer-events-none'
          : 'sr-only'}
      >
        {feedback}
      </span>
    </div>
  );
}
