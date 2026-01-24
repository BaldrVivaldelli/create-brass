import { useMemo, useRef, useState } from "react";
import ScopeBoxesCanvas from "./ui/ScopeBoxesCanvas";
import type { TourEvent, Task } from "./types";
import { createDemoController } from "./runtime/demoCases";

type ScopeView = { id: string; label: string; isClosed: boolean };

function formatEvent(e: TourEvent): string {
  switch (e.t) {
    case "scope_created":
      return `Scope created: ${e.scopeId} (${e.label})`;
    case "scope_closed":
      return `Scope closed: ${e.scopeId}`;
    case "task_created":
      return `Task started: ${e.task.id} (${e.task.label})`;
    case "task_state":
      return `Task ${e.taskId}: ${e.state}`;
    case "finalizer_progress":
      return `Cleanup ${e.taskId}: ${e.ran}/${e.total}`;
    case "note":
      return `• ${e.message}`;
  }
}

type Mode =
  | "simple:get"
  | "simple:get404"
  | "meta:get"
  | "meta:post"
  | "par:withScope"
  | "par:manual";

const MODE_LABEL: Record<Mode, string> = {
  "simple:get": "Simple GET (abortable fetch)",
  "simple:get404": "GET 404 → error (fetch doesn’t throw)",
  "meta:get": "GET with meta (durationMs)",
  "meta:post": "POST with meta (id + durationMs)",
  "par:withScope": "Parallel POST ×2 (withScopeAsync + zipPar)",
  "par:manual": "Parallel POST ×2 (manual Scope + zipPar)"
};

export default function App() {
  const [scope, setScope] = useState<ScopeView | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("simple:get");

  const controllerRef = useRef<ReturnType<typeof createDemoController> | null>(null);

  const emit = useMemo(() => {
    return (e: TourEvent) => {
      setEvents((xs) => [formatEvent(e), ...xs].slice(0, 260));

      if (e.t === "scope_created") {
        setScope({ id: e.scopeId, label: e.label, isClosed: false });
      } else if (e.t === "scope_closed") {
        // We keep the state (useful for logic), but we don't print "closed" on the canvas.
        setScope((s) => (s ? { ...s, isClosed: true } : s));
      } else if (e.t === "task_created") {
        setTasks((xs) => [...xs.filter((t) => t.id !== e.task.id), e.task]);
      } else if (e.t === "task_state") {
        setTasks((xs) => xs.map((t) => (t.id === e.taskId ? { ...t, state: e.state } : t)));
      } else if (e.t === "finalizer_progress") {
        setTasks((xs) =>
          xs.map((t) =>
            t.id === e.taskId ? { ...t, finalizers: { ran: e.ran, total: e.total } } : t
          )
        );
      }
    };
  }, []);

  const ensureController = () => {
    if (!controllerRef.current) controllerRef.current = createDemoController(emit);
    return controllerRef.current;
  };

  const reset = () => {
    controllerRef.current = null;
    setEvents([]);
    setTasks([]);
    setScope(null);
  };

  const run = async () => {
    const c = ensureController();
    // Fresh UI each run
    setEvents([]);
    setTasks([]);
    setScope(null);

    // Init message + scope
    c.init();

    // Run selected scenario
    if (mode === "simple:get") await c.runSimpleGet();
    else if (mode === "simple:get404") await c.runSimpleGet404();
    else if (mode === "meta:get") await c.runMetaGet();
    else if (mode === "meta:post") await c.runMetaPost();
    else if (mode === "par:withScope") await c.runParWithScope();
    else if (mode === "par:manual") await c.runParManualScope();
  };

  return (
    <div className="wrap">
      <h1>Brass Runtime – HTTP + Template</h1>
      <p>
        A progressive, beginner-friendly demo: scopes are boxes, tasks run inside, and events explain what’s happening.
        Pick a scenario and press Run.
      </p>

      <div className="controls">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white" }}
        >
          {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
            <option key={m} value={m}>{MODE_LABEL[m]}</option>
          ))}
        </select>

        <button className="primary" onClick={() => void run()}>Run</button>
        <button className="danger" onClick={() => ensureController().hardCancel()}>Hard cancel</button>
        <button onClick={() => ensureController().cancel()}>Cancel (soft)</button>
        <button onClick={reset}>Reset</button>

        <span className="badge"><span className="dot" /> Tip: run “Parallel POST ×2” to see structured concurrency</span>
      </div>

      <div className="grid">
        <div className="card">
          <ScopeBoxesCanvas scope={scope} tasks={tasks} />
          <small className="muted">
            Wire your real Brass exports in <code>src/runtime/demoCases.ts</code> if needed.
            This demo emits human explanations as <code>note</code> events while work is running.
          </small>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <strong>Events</strong>
            <small className="muted">newest first</small>
          </div>
          <div className="log" style={{ marginTop: 10 }}>
            {events.length === 0 ? "No events yet. Pick a scenario and press Run." : events.join("\n")}
          </div>
        </div>
      </div>
    </div>
  );
}
