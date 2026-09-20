/**
 * Optional compatibility adapter for custom visual tours.
 *
 * This template uses a Tour that emits high-level events.
 * You can implement it either:
 *  - by *simulating* events (default) OR
 *  - by driving events from real Brass runtime callbacks.
 *
 * Keep this adapter small so templates stay stable across runtime refactors.
 */

export type Cancel = () => void;

export type BrassHandles = {
  startDemo: (emit: (e: any) => void) => { cancel: Cancel };
};

/**
 * Default: a stub handle. The active runtime demo lives in demoCases.ts and
 * imports Brass only through brass.ts.
 */
export function makeBrassHandles(): BrassHandles {
  return {
    startDemo() {
      return { cancel: () => {} };
    }
  };
}
