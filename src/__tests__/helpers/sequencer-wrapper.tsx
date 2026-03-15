import { type ReactNode } from 'react';
import { SequencerProvider } from '../../app/SequencerContext';

/**
 * Test wrapper that renders SequencerProvider around children.
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  return <SequencerProvider>{children}</SequencerProvider>;
}
