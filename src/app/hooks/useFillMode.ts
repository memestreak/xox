import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

export interface UseFillModeReturn {
  isFillActive: boolean;
  fillMode: 'off' | 'latched' | 'momentary';
  fillActiveRef: React.RefObject<boolean>;
  toggleFillLatch: () => void;
  setFillHeld: (held: boolean) => void;
  reset: () => void;
}

/**
 * Manages fill mode state: latched (Ctrl/Cmd+F) and
 * momentary (hold F). Owns the F-key keyboard effect.
 */
export function useFillMode(): UseFillModeReturn {
  const [isLatched, setIsLatched] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const fillActiveRef = useRef(false);

  const isFillActive = isLatched || isHeld;
  const fillMode: 'off' | 'latched' | 'momentary' =
    isHeld ? 'momentary'
      : isLatched ? 'latched'
        : 'off';

  const toggleFillLatch = useCallback(() => {
    setIsLatched(prev => {
      const next = !prev;
      fillActiveRef.current = next || isHeld;
      return next;
    });
  }, [isHeld]);

  const setFillHeld = useCallback(
    (held: boolean) => {
      setIsHeld(held);
      if (!held) {
        setIsLatched(false);
        fillActiveRef.current = false;
      } else {
        fillActiveRef.current = true;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsLatched(false);
    setIsHeld(false);
    fillActiveRef.current = false;
  }, []);

  // F-key keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.repeat) return;
      const tag =
        (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        toggleFillLatch();
      } else {
        setFillHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF') return;
      setFillHeld(false);
    };

    document.addEventListener(
      'keydown', handleKeyDown
    );
    document.addEventListener(
      'keyup', handleKeyUp
    );
    return () => {
      document.removeEventListener(
        'keydown', handleKeyDown
      );
      document.removeEventListener(
        'keyup', handleKeyUp
      );
    };
  }, [toggleFillLatch, setFillHeld]);

  return {
    isFillActive,
    fillMode,
    fillActiveRef,
    toggleFillLatch,
    setFillHeld,
    reset,
  };
}
