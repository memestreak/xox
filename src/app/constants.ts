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
/** Max edge-distance for nearest-cell lookup in gaps (px). */
export const NEAREST_CELL_MAX_DISTANCE_PX = 30;
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

/** Master limiter threshold (dBFS). */
export const LIMITER_THRESHOLD_DB = -1;
/** Master limiter attack time (seconds). */
export const LIMITER_ATTACK_S = 0.003;
/** Master limiter release time (seconds). */
export const LIMITER_RELEASE_S = 0.1;

// ── Master volume and level meter ───────────────────
/**
 * Default master fader position (0-1) for a device
 * with no saved level. The fader is cubic (1 is 0 dB),
 * so 0.8 is about −5.8 dB: headroom below the limiter,
 * and room to turn up rather than down on first play.
 */
export const MASTER_VOLUME_DEFAULT = 0.8;
/** Time constant for master volume changes (seconds). */
export const MASTER_VOLUME_SMOOTHING_S = 0.01;
/** Samples per level-meter reading (per channel). */
export const METER_FFT_SIZE = 512;
/** Quietest level the meter shows (dBFS). */
export const METER_FLOOR_DB = -48;
/** LED segments per meter channel. */
export const METER_SEGMENTS = 24;
/** How fast the meter falls back after a peak (dB/s). */
export const METER_DECAY_DB_PER_S = 30;

// ── UI timing ───────────────────────────────────────
/** Duration of the triggered-track flash highlight (ms). */
export const TRIGGER_FLASH_MS = 150;
/** Duration of copy/export feedback messages (ms). */
export const FEEDBACK_TIMEOUT_MS = 1500;
/** Delay after the last edit before autosaving (ms). */
export const AUTOSAVE_DEBOUNCE_MS = 300;

// ── Tempo ───────────────────────────────────────────
export const BPM_MIN = 20;
export const BPM_MAX = 300;
export const DEFAULT_BPM = 110;
/** Vertical px of drag per tempo step on the BPM field. */
export const BPM_DRAG_PX_PER_STEP = 4;
/** Tempo change per drag step (BPM). */
export const BPM_DRAG_STEP = 1;
/** Tempo change per drag step with Shift held (BPM). */
export const BPM_DRAG_FINE_STEP = 0.1;

// ── Steps entry ─────────────────────────────────────
/** Vertical px of drag per step on the Steps field. */
export const STEPS_DRAG_PX_PER_STEP = 4;
/** Steps per ↑/↓ press with Shift held (one beat). */
export const STEPS_SHIFT_STEP = 4;
/** Hold an arrow key this long before it repeats. */
export const STEPS_REPEAT_DELAY_MS = 400;
/** Time between repeats while an arrow is held. */
export const STEPS_REPEAT_INTERVAL_MS = 80;

/** Maximum swing amount. */
export const SWING_MAX = 100;
/** Columns the pattern chooser's list aims for. */
export const PATTERN_LIST_COLUMNS = 4;

// ── LCD dropdown (LcdSelect) ────────────────────────
/** Gap between a dropdown key and its list, in px. */
export const DROPDOWN_LIST_GAP_PX = 4;
/** Tallest a dropdown list grows before it scrolls. */
export const DROPDOWN_LIST_MAX_HEIGHT_PX = 280;
/** Keeps a dropdown list this far from the window edges. */
export const DROPDOWN_VIEWPORT_MARGIN_PX = 8;
/** Dropdown type-ahead forgets earlier letters after this. */
export const DROPDOWN_TYPEAHEAD_RESET_MS = 600;
/** Rest on a dropdown row this long to see its help. */
export const DROPDOWN_HINT_DELAY_MS = 500;
/** Gap between a dropdown list and a row's help, in px. */
export const DROPDOWN_HINT_GAP_PX = 6;
