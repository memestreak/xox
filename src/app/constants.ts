/**
 * Centralized constants for the XOX sequencer.
 *
 * ALL timing, threshold, and tuning values live here.
 * Import from this file instead of using inline literals.
 */

// ── Audio scheduling ────────────────────────────────
/** How often to call the look-ahead scheduler (ms). */
export const LOOKAHEAD_MS = 25.0;
/** How far ahead to schedule audio events (seconds). */
export const SCHEDULE_AHEAD_S = 0.1;

// ── Gesture thresholds ──────────────────────────────
/** Duration before a press becomes a long-press (ms). */
export const LONG_PRESS_MS = 500;
/** Movement tolerance for StepButton long-press (px). */
export const LONG_PRESS_CANCEL_PX = 5;
/** Movement tolerance for TrackEndBar long-press (px). */
export const ENDBAR_LONG_PRESS_CANCEL_PX = 1;
/** Minimum pointer movement before starting a drag (px). */
export const DRAG_THRESHOLD_PX = 5;
/** Touch distance to start cycle mode (px). */
export const CYCLE_THRESHOLD_TOUCH_PX = 10;
/** Vertical px per step when cycling patterns. */
export const CYCLE_PX_PER_STEP = 6;

// ── Sequencer limits ────────────────────────────────
/** Maximum steps a pattern can have. */
export const MAX_PATTERN_LENGTH = 64;
/** Default track length for new configs. */
export const DEFAULT_TRACK_LENGTH = 16;

// ── Gain / mixing ───────────────────────────────────
/** Multiplier applied when accent track is active. */
export const ACCENT_GAIN_MULTIPLIER = 2;
/** Exponent for cubic gain curve (perceived loudness). */
export const GAIN_EXPONENT = 3;

// ── UI timing ───────────────────────────────────────
/** Duration of the triggered-track flash highlight (ms). */
export const TRIGGER_FLASH_MS = 150;
/** Duration of copy/export feedback messages (ms). */
export const FEEDBACK_TIMEOUT_MS = 1500;

// ── Tempo ───────────────────────────────────────────
export const BPM_MIN = 20;
export const BPM_MAX = 300;
export const DEFAULT_BPM = 110;
/** Maximum swing amount. */
export const SWING_MAX = 100;
