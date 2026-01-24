/**
 * Wire your real Brass API here.
 *
 * This template uses a Tour that emits high-level events.
 * You can implement it either:
 *  - by *simulating* events (default) OR
 *  - by driving events from real Brass runtime callbacks.
 *
 * Keep this adapter small so templates stay stable across runtime refactors.
 */

// Example placeholder exports — replace with your real ones:
// import { fork, withScope } from "brass-runtime";

export type Cancel = () => void;

export type BrassHandles = {
  startDemo: (emit: (e: any) => void) => { cancel: Cancel };
};

/**
 * Default: a stub handle (the actual demo logic is in brassTour.ts).
 * Replace if you want to run real Effects and emit real events.
 */
export function makeBrassHandles(): BrassHandles {
  return {
    startDemo() {
      return { cancel: () => {} };
    }
  };
}
