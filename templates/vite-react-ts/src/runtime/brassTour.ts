import type { TourEvent, Task } from "../types";

/**
 * This file defines the visual story in terms of high-level events.
 * It's currently a deterministic *script* so it works out-of-the-box.
 *
 * Later: replace the script with real Brass execution and emit the same events.
 */

export type TourHandle = { cancel: () => void };

export function startScopeBoxesTour(emit: (e: TourEvent) => void): TourHandle {
  let cancelled = false;
  const timers: number[] = [];

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => { if (!cancelled) fn(); }, ms);
    timers.push(id);
  };

  const scopeId = "S1";
  emit({ t: "scope_created", scopeId, label: "Request scope" });

  const mkTask = (id: string, label: string): Task => ({
    id,
    scopeId,
    label,
    state: "running",
    finalizers: { ran: 0, total: 1 }
  });

  later(200, () => {
    emit({ t: "note", message: "A request starts work inside a scope." });
    emit({ t: "task_created", task: mkTask("F1", "fetch user") });
  });

  later(450, () => emit({ t: "task_created", task: mkTask("F2", "fetch posts") }));
  later(650, () => emit({ t: "task_created", task: mkTask("F3", "render feed") }));

  // Some tasks complete naturally if you don't cancel.
  later(2200, () => emit({ t: "task_state", taskId: "F1", state: "done" }));
  later(3200, () => emit({ t: "task_state", taskId: "F2", state: "done" }));
  later(4200, () => emit({ t: "task_state", taskId: "F3", state: "done" }));

  const closeScope = () => {
    emit({ t: "scope_closed", scopeId });
    emit({ t: "note", message: "Closing the scope stops remaining work and runs cleanup." });

    const toFinalize = ["F1", "F2", "F3"];
    for (const id of toFinalize) {
      emit({ t: "task_state", taskId: id, state: "finalizing" });
      emit({ t: "finalizer_progress", taskId: id, ran: 0, total: 1 });
      later(450, () => emit({ t: "finalizer_progress", taskId: id, ran: 1, total: 1 }));
      later(800, () => emit({ t: "task_state", taskId: id, state: "interrupted" }));
    }
  };

  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
      // In a real adapter you'd call scope.close() or interrupt fibers here.
      closeScope();
    }
  };
}
