/**
 * Adjust the imports in this file to match your Brass API.
 * This template is intentionally minimal and "wiring-friendly".
 */

// Example placeholder imports – replace with your real ones:
import { fork, withScope } from "brass-runtime";
type Env = any;

type Handle = { cancel?: () => void };

export function createTour(append: (s: string) => void) {
  const env: Env = {};

  function demoFiberCancel(): Handle {
    append("— Demo 1: fiber + cancel —");

    // TODO: replace with a real Effect/Async from Brass
    const effect = { _tag: "DemoEffect" };

    const fiber = fork(effect as any, env);

    // TODO: adjust join signature
    (fiber as any).join?.((exit: any) => append(`join: ${String(exit)}`));

    return {
      cancel: () => {
        // If fibers can be interrupted:
        (fiber as any).interrupt?.();
        append("interrupt() called");
      }
    };
  }

  function demoScope(): Handle {
    append("— Demo 2: scope.close cancels children —");
    let cancel = () => {};

    withScope((scope: any) => {
      // TODO: replace with a real Effect/Async
      const eff = { _tag: "ScopedDemo" };

      // TODO: adjust scope.fork signature
      (scope as any).fork?.(eff as any, env);

      cancel = () => {
        (scope as any).close?.();
        append("scope.close() called");
      };
    });

    return { cancel };
  }

  return { demoFiberCancel, demoScope };
}
