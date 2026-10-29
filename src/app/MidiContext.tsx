"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { midiEngine } from './MidiEngine';
import type { MidiConfig } from './types';

interface MidiContextValue {
  available: boolean;
  initialized: boolean;
  /** The saved MIDI settings (Sequencer › MIDI). */
  config: MidiConfig;
  outputs: MIDIOutput[];
  /**
   * Ask the browser for MIDI access, so the device list
   * fills in. Resolves to whether MIDI is available.
   */
  requestAccess: () => Promise<boolean>;
  /** Save new MIDI settings (Settings' OK / Apply). */
  applyConfig: (next: MidiConfig) => void;
}

const MidiContext = createContext<
  MidiContextValue | null
>(null);

export function useMidi(): MidiContextValue | null {
  return useContext(MidiContext);
}

interface MidiProviderProps {
  children: ReactNode;
}

export function MidiProvider({
  children,
}: MidiProviderProps) {
  const [available, setAvailable] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [config, setConfig] = useState<MidiConfig>(
    () => midiEngine.getConfig()
  );
  const [outputs, setOutputs] = useState<MIDIOutput[]>(
    []
  );

  const finishInit = useCallback((ok: boolean) => {
    setAvailable(ok);
    setInitialized(true);
    if (ok) setOutputs(midiEngine.getOutputs());
    return ok;
  }, []);

  const requestAccess = useCallback(async () => {
    midiEngine.setOnDeviceChange(setOutputs);
    // init() runs once; later calls return its result.
    return finishInit(await midiEngine.init());
  }, [finishInit]);

  // Saved as enabled: connect on load.
  useEffect(() => {
    if (!midiEngine.getConfig().enabled) return;
    midiEngine.setOnDeviceChange(setOutputs);
    void midiEngine.init().then(finishInit);
  }, [finishInit]);

  useEffect(() => {
    return () => {
      midiEngine.setOnDeviceChange(null);
    };
  }, []);

  const applyConfig = useCallback((next: MidiConfig) => {
    midiEngine.applyConfig(next);
    setConfig(midiEngine.getConfig());
    if (next.enabled) void requestAccess();
  }, [requestAccess]);

  return (
    <MidiContext value={{
      available,
      initialized,
      config,
      outputs,
      requestAccess,
      applyConfig,
    }}>
      {children}
    </MidiContext>
  );
}
