import "./styles.css";
import type { TourEvent, Task } from "./types";
import { renderScopeBoxesCanvas } from "./ui/scopeBoxesCanvas";
import { MODE_LABEL, createDemoController } from "./runtime/demoCases";

type ScopeView = { id: string; label: string };

type Mode = keyof typeof MODE_LABEL;

const modeSel = document.querySelector<HTMLSelectElement>("#mode")!;
const runBtn = document.querySelector<HTMLButtonElement>("#run")!;
const hardBtn = document.querySelector<HTMLButtonElement>("#hardCancel")!;
const softBtn = document.querySelector<HTMLButtonElement>("#softCancel")!;
const resetBtn = document.querySelector<HTMLButtonElement>("#reset")!;
const canvasEl = document.querySelector<HTMLDivElement>("#canvas")!;
const eventsEl = document.querySelector<HTMLPreElement>("#events")!;

let scope: ScopeView | null = null;
let tasks: Task[] = [];
let events: string[] = [];

function formatEvent(e: TourEvent): string {
  switch (e.t) {
    case "scope_created": return `Scope created: ${e.scopeId} (${e.label})`;
    case "scope_closed": return `Scope closed: ${e.scopeId}`;
    case "task_created": return `Task started: ${e.task.id} (${e.task.label})`;
    case "task_state": return `Task ${e.taskId}: ${e.state}`;
    case "finalizer_progress": return `Cleanup ${e.taskId}: ${e.ran}/${e.total}`;
    case "note": return `• ${e.message}`;
  }
}

function render() {
  canvasEl.innerHTML = renderScopeBoxesCanvas({ scope, tasks });
  eventsEl.textContent = events.length === 0 ? "No events yet. Click Run." : events.join("\n");
}

const controller = createDemoController((e: TourEvent) => {
  events = [formatEvent(e), ...events].slice(0, 220);

  if (e.t === "scope_created") {
    scope = { id: e.scopeId, label: e.label };
  } else if (e.t === "scope_closed") {
    // keep UI simple (we don't display "closed"), but scope may be cleared if you prefer:
    // scope = null;
  } else if (e.t === "task_created") {
    tasks = [...tasks.filter(t => t.id !== e.task.id), e.task];
  } else if (e.t === "task_state") {
    tasks = tasks.map((t) => (t.id === e.taskId ? { ...t, state: e.state } : t));
  } else if (e.t === "finalizer_progress") {
    tasks = tasks.map((t) =>
      t.id === e.taskId ? { ...t, finalizers: { ran: e.ran, total: e.total } } : t
    );
  }

  render();
});

function reset() {
  events = [];
  tasks = [];
  scope = null;
  render();
  controller.init();
}

for (const k of Object.keys(MODE_LABEL) as Mode[]) {
  const opt = document.createElement("option");
  opt.value = k;
  opt.textContent = MODE_LABEL[k];
  modeSel.appendChild(opt);
}

modeSel.value = "simple:get";
modeSel.addEventListener("change", () => controller.setMode(modeSel.value as any));

runBtn.addEventListener("click", () => { void controller.run(); });
hardBtn.addEventListener("click", () => controller.hardCancel());
softBtn.addEventListener("click", () => controller.cancel());
resetBtn.addEventListener("click", reset);

reset();
