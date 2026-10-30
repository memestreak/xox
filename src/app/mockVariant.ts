import { useEffect, useState } from 'react';

/**
 * MOCK ONLY: reads `?mock=A|B|C` from the URL so one
 * build can show design variants side by side. Not for
 * main. Read after mount so hydration matches.
 */
export function useMockVariant(): string | null {
  const [mock, setMock] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMock(
      new URLSearchParams(window.location.search).get('mock'),
    );
  }, []);
  return mock;
}
