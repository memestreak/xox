import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  MidiProvider,
  useMidi,
} from '../app/MidiContext';
import { midiEngine } from '../app/MidiEngine';

vi.mock('../app/MidiEngine', () => ({
  midiEngine: {
    init: vi.fn().mockResolvedValue(false),
    getConfig: vi.fn().mockReturnValue({
      enabled: false,
      deviceId: null,
      channel: 10,
      noteLength: { type: 'fixed', ms: 50 },
      tracks: {},
    }),
    getOutputs: vi.fn().mockReturnValue([]),
    setOnDeviceChange: vi.fn(),
    updateConfig: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(false),
  },
}));

const mockedEngine = vi.mocked(midiEngine);

describe('MidiContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useMidi returns null outside MidiProvider', () => {
    const { result } = renderHook(() => useMidi());
    expect(result.current).toBeNull();
  });

  it('MidiProvider renders children', () => {
    render(
      <MidiProvider>
        <span data-testid="child">hello</span>
      </MidiProvider>
    );
    expect(
      screen.getByTestId('child').textContent
    ).toBe('hello');
  });

  it('initial state has available=false and initialized=false', () => {
    const { result } = renderHook(() => useMidi(), {
      wrapper: ({ children }) => (
        <MidiProvider>{children}</MidiProvider>
      ),
    });
    expect(result.current).not.toBeNull();
    expect(result.current!.available).toBe(false);
    expect(result.current!.initialized).toBe(false);
    expect(result.current!.outputs).toEqual([]);
  });

  it('updateConfig calls midiEngine.updateConfig', async () => {
    const { result } = renderHook(() => useMidi(), {
      wrapper: ({ children }) => (
        <MidiProvider>{children}</MidiProvider>
      ),
    });

    await act(async () => {
      await result.current!.updateConfig({
        channel: 5,
      });
    });

    expect(
      mockedEngine.updateConfig
    ).toHaveBeenCalledWith({ channel: 5 });
    expect(mockedEngine.getConfig).toHaveBeenCalled();
  });
});
