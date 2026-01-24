export type TaskState = "running" | "finalizing" | "done" | "failed" | "interrupted";

export type ScopeId = string;
export type TaskId = string;

export type Task = {
  id: TaskId;
  scopeId: ScopeId;
  label: string;
  state: TaskState;
  finalizers?: { ran: number; total: number };
};

export type TourEvent =
  | { t: "scope_created"; scopeId: ScopeId; label: string }
  | { t: "scope_closed"; scopeId: ScopeId }
  | { t: "task_created"; task: Task }
  | { t: "task_state"; taskId: TaskId; state: TaskState }
  | { t: "finalizer_progress"; taskId: TaskId; ran: number; total: number }
  | { t: "note"; message: string };
