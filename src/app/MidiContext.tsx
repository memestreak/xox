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
  config: MidiConfig;
  outputs: MIDIOutput[];
  updateConfig: (partial: Partial<MidiConfig>) => void;
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
  const [config, setConfig] = useState<MidiConfig>(
    defaultMidiConfig
  );
  const [outputs, setOutputs] = useState<MIDIOutput[]>(
    []
  );

  useEffect(() => {
    let mounted = true;

    midiEngine.setOnDeviceChange((newOutputs) => {
      if (mounted) setOutputs(newOutputs);
    });

    midiEngine.init().then((ok) => {
      if (!mounted) return;
      setAvailable(ok);
      if (ok) {
        setConfig(midiEngine.getConfig());
        setOutputs(midiEngine.getOutputs());
      }
    });

    return () => {
      mounted = false;
      midiEngine.setOnDeviceChange(null);
    };
  }, []);

  const updateConfig = useCallback(
    (partial: Partial<MidiConfig>) => {
      midiEngine.updateConfig(partial);
      setConfig(midiEngine.getConfig());
    },
    []
  );

  return (
    <MidiContext value={{
      available,
      config,
      outputs,
      updateConfig,
    }}>
      {children}
    </MidiContext>
  );
}
