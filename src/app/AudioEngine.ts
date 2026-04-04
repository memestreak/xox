"use client";

import { TrackId } from './types';
import { LOOKAHEAD_MS, SCHEDULE_AHEAD_S } from './constants';

// Minimal silent WAV (8-bit mono, 7 samples at 44100 Hz).
// Playing this via an <audio> element forces iOS to switch
// from the "ambient" audio session (respects mute switch)
// to the "playback" category (ignores mute switch).
const SILENT_WAV =
  'data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEA' +
  'RKwAAESsAAABAAgAZGF0YQcAAACAgICAgICAAAA=';

/**
 * AudioEngine manages the Web Audio API context, sample loading, and
 * high-precision playback timing.
 *
 * It implements a "Look-Ahead" scheduler as described by Chris Wilson
 * (HTML5Rocks) to ensure rock-solid timing in the browser, even when
 * the main thread is busy with UI updates.
 *
 * Logic Overview:
 * - A high-priority timer (setTimeout) runs frequently (every ~25 ms).
 * - On each "tick", it checks if any notes need to be scheduled within the next ~100ms.
 * - Notes are scheduled for exactly when they should play using AudioContext.currentTime.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers: Map<TrackId, AudioBuffer> = new Map();
  private silentAudio: HTMLAudioElement | null = null;

  // Scheduler State
  private nextStepTime: number = 0;
  private currentStep: number = 0;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private pendingReset = false;

  // Scheduler Configuration
  private bpm: number = 110;
  private patternLength: number = 16;
  private lookahead: number = LOOKAHEAD_MS;
  private scheduleAheadTime: number = SCHEDULE_AHEAD_S;

  /**
   * Callback triggered when a step passes.
   * Useful for syncing UI visuals or triggering sounds in the React component.
   */
  public onStep: (step: number, time: number) => void = () => {};
  public onLoadError: (message: string) => void = () => {};

  constructor() {}

  /**
   * Initializes the AudioContext. Called eagerly during
   * preloadKit so samples can be decoded immediately.
   * On iOS the context may start suspended; it is resumed
   * on the first user gesture in start().
   */
  private init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  /**
   * Bypasses the iOS hardware Silent Mode switch by playing
   * a looping silent <audio> element. This forces the audio
   * session from "ambient" (obeys mute) to "playback"
   * (ignores mute). Must be called within a user gesture.
   * Harmless no-op on non-iOS platforms.
   */
  private bypassSilentMode() {
    if (this.silentAudio) return;
    const audio = document.createElement('audio');
    audio.setAttribute('x-webkit-airplay', 'deny');
    audio.preload = 'auto';
    audio.loop = true;
    audio.src = SILENT_WAV;
    audio.load();
    audio.play().catch(() => {});
    this.silentAudio = audio;
  }

  /**
   * Fetches and decodes audio samples for a specific kit folder.
   * Samples are stored in memory as AudioBuffers.
   *
   * @param kitFolder - The folder containing the kit samples. E.g., "808"
   */
  public async preloadKit(kitFolder: string) {
    this.init();
    const sounds: TrackId[] = ['bd', 'sd', 'ch', 'oh', 'ac', 'cy', 'ht', 'mt', 'lt', 'rs', 'cp', 'cb'];
    const filenames: Partial<Record<TrackId, string>> = {
      bd: 'bd.wav',
      sd: 'sd.wav',
      ch: 'ch.wav',
      oh: 'oh.wav',
      cy: 'cy.wav',
      ht: 'ht.wav',
      mt: 'mt.wav',
      lt: 'lt.wav',
      rs: 'rs.wav',
      cp: 'cp.wav',
      cb: 'cb.wav'
    };

    this.buffers.clear();

    const promises = sounds.map(async (id) => {
      const filename = filenames[id];
      if (!filename) return;

      try {
        const response = await fetch(`/kits/${kitFolder}/${filename}`);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
        this.buffers.set(id, audioBuffer);
      } catch (e) {
        console.error(`Failed to load ${id} for kit ${kitFolder}`, e);
        this.onLoadError(
          `Failed to load ${id} sample for kit "${kitFolder}"`
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * Starts the sequencer playback loop. Must be called from a
   * user gesture (tap/click) to ensure iOS audio works.
   */
  public async start(
    bpm: number,
    onStep: (step: number, time: number) => void,
    patternLength: number = 16
  ) {
    this.init();
    this.bypassSilentMode();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    this.bpm = bpm;
    this.patternLength = patternLength;
    this.onStep = onStep;
    this.nextStepTime = this.ctx!.currentTime;
    this.currentStep = 0;
    this.scheduler();
  }

  /**
   * Stops the sequencer playback loop.
   */
  public stop() {
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Updates the BPM in real-time.
   */
  public setBpm(bpm: number) {
    this.bpm = bpm;
  }

  /**
   * Updates the pattern length in real-time.
   */
  public setPatternLength(length: number) {
    this.patternLength = length;
  }

  /**
   * Requests a step counter reset to 0 on the next
   * advanceStep() call. Safe to call from inside onStep.
   */
  public requestReset() {
    this.pendingReset = true;
  }

  /**
   * The core scheduling loop.
   * It looks ahead in time and pre-schedules events to the AudioContext timeline.
   */
  private scheduler = () => {
    // While there are notes that will need to play before the next "lookahead" check...
    while (this.nextStepTime < this.ctx!.currentTime + this.scheduleAheadTime) {
      this.onStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    this.schedulerTimer = setTimeout(this.scheduler, this.lookahead);
  };

  /**
   * Calculates the timing for the next step based on current BPM.
   */
  private advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextStepTime += 0.25 * secondsPerBeat;
    if (this.pendingReset) {
      this.currentStep = 0;
      this.pendingReset = false;
    } else {
      this.currentStep =
        (this.currentStep + 1) % this.patternLength;
    }
  }

  /**
   * Plays a specific buffer at a precise point in the future.
   */
  public playSound(
    id: TrackId, time: number,
    gainValue: number, panValue = 0.5
  ) {
    const buffer = this.buffers.get(id);
    if (!buffer || !this.ctx || !this.masterGain) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Create a local gain node for this specific sound trigger (for mixing/balance)
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = gainValue;

    source.connect(trackGain);

    // Insert a StereoPannerNode when not centered
    if (panValue !== 0.5) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = (panValue - 0.5) * 2;
      trackGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      trackGain.connect(this.masterGain);
    }

    // Schedule the sound to start at the exact 'time' calculated by the scheduler
    source.start(time);
  }

  /**
   * Returns the current AudioContext time in seconds.
   * Used by MIDI integration to convert audio time to
   * performance.now() timestamps.
   */
  public getCurrentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }
}

export const audioEngine = new AudioEngine();
