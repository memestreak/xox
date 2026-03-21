import { type ReactNode } from 'react';
import { SequencerProvider } from '../../app/SequencerContext';
import { TooltipProvider } from '../../app/TooltipContext';

/**
 * Test wrapper that renders SequencerProvider around children.
 */
export function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <SequencerProvider>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </SequencerProvider>
  );
}
