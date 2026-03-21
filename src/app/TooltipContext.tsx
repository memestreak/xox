"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'xox-tooltips';

interface TooltipContextValue {
  tooltipsEnabled: boolean;
  setTooltipsEnabled: (value: boolean) => void;
}

const TooltipContext = createContext<
  TooltipContextValue
>({
  tooltipsEnabled: true,
  setTooltipsEnabled: () => {},
});

export function TooltipProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [tooltipsEnabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return (
        window.localStorage.getItem(STORAGE_KEY)
        !== 'false'
      );
    } catch {
      return true;
    }
  });

  const setTooltipsEnabled = useCallback(
    (value: boolean) => {
      setEnabled(value);
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          String(value)
        );
      } catch {
        // localStorage unavailable
      }
    },
    []
  );

  return (
    <TooltipContext
      value={{ tooltipsEnabled, setTooltipsEnabled }}
    >
      {children}
    </TooltipContext>
  );
}

export function useTooltips() {
  return useContext(TooltipContext);
}
