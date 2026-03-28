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
import { defaultMidiConfig } from './types';

interface MidiContextValue {
  available: boolean;
  initialized: boolean;
  config: MidiConfig;
  outputs: MIDIOutput[];
  updateConfig: (
    partial: Partial<MidiConfig>
  ) => void | Promise<void>;
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
    defaultMidiConfig
  );
  const [outputs, setOutputs] = useState<MIDIOutput[]>(
    []
  );

  const initMidi = useCallback(async () => {
    if (initialized) return;
    midiEngine.setOnDeviceChange((newOutputs) => {
      setOutputs(newOutputs);
    });
    const ok = await midiEngine.init();
    setAvailable(ok);
    setInitialized(true);
    if (ok) {
      setConfig(midiEngine.getConfig());
      setOutputs(midiEngine.getOutputs());
    }
  }, [initialized]);

  useEffect(() => {
    return () => {
      midiEngine.setOnDeviceChange(null);
    };
  }, []);

  const updateConfig = useCallback(
    async (partial: Partial<MidiConfig>) => {
      if (partial.enabled && !initialized) {
        await initMidi();
        // If MIDI isn't available after init, don't
        // persist the enabled flag
        if (!midiEngine.isAvailable()) {
          return;
        }
      }
      midiEngine.updateConfig(partial);
      setConfig(midiEngine.getConfig());
    },
    [initialized, initMidi]
  );

  return (
    <MidiContext value={{
      available,
      initialized,
      config,
      outputs,
      updateConfig,
    }}>
      {children}
    </MidiContext>
  );
}
