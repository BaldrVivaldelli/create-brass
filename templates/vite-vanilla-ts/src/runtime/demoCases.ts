import type { Task, TourEvent } from "../types";

// Use your real exports (these match your example snippet).
import { fromPromiseAbortable, Scope, toPromise, withScope, zipPar } from "brass-runtime";
import { httpClient, httpClientWithMeta } from "brass-runtime/http";

type Env = any;

type Post = { id: number; userId: number; title: string; body: string };
type NewPost = Omit<Post, "id">;

type Mode =
  | "simple:get"
  | "simple:get404"
  | "meta:get"
  | "meta:post"
  | "par:withScope"
  | "par:manual";

export const MODE_LABEL: Record<Mode, string> = {
  "simple:get": "Simple GET (abortable fetch)",
  "simple:get404": "Simple GET 404 → throw (fetch doesn't throw)",
  "meta:get": "HTTP client with meta: GET /posts/1",
  "meta:post": "HTTP client with meta: POST /posts",
  "par:withScope": "Parallel POST ×2 (withScope + zipPar)",
  "par:manual": "Parallel POST ×2 (manual Scope + zipPar)"
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function safeJson(bodyText: string) {
  try { return JSON.parse(bodyText); } catch { return undefined; }
}

function summarizeHttp(x: any) {
  const status = x?.status ?? x?.wire?.status ?? x?.response?.status;
  const ms = x?.ms ?? x?.wire?.ms ?? x?.meta?.durationMs;
  const body = x?.body ?? x?.response?.body;
  const id = body?.id ?? safeJson(x?.bodyText ?? x?.wire?.bodyText ?? "")?.id;
  return { status, ms, id };
}

function mkTask(id: string, scopeId: string, label: string): Task {
  return { id, scopeId, label, state: "running", finalizers: { ran: 0, total: 1 } };
}

export type DemoController = {
  init: () => void;
  setMode: (m: Mode) => void;
  run: () => Promise<void>;
  cancel: () => void;
  hardCancel: () => void;
};

export function createDemoController(emit: (e: TourEvent) => void): DemoController {
  const env: Env = {};
  const scopeId = "S1";

  // Track what is currently "running" in the UI so hard-cancel can stop it.
  let scopeOpen = false;
  const runningTasks = new Set<string>();

  // For progressive narration + a "soft cancel" (stops emitting new events).
  let runToken = 0;
  let mode: Mode = "simple:get";

  const nextToken = () => ++runToken;
  const isStale = (t: number) => t !== runToken;

  const note = (message: string) => emit({ t: "note", message });

  const init = () => {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    note("This scope is a container for work. Tasks created inside can be cleaned up together.");
    note("Pick a scenario, click Run. You’ll see tasks move across states with progressive explanations.");
    if (isStale(t)) return;
  };

  const setMode = (m: Mode) => { mode = m; };

  const cancel = () => {
    // Soft cancel: stop the scripted narration AND make the UI transition visible.
    // It does NOT run cleanup; it simply marks currently-running tasks as stopped.
    nextToken();

    note("Cancel requested. (Soft-cancel: stops the demo narration and marks running tasks as stopped.)");

    for (const id of Array.from(runningTasks)) {
      emit({ t: "task_state", taskId: id, state: "interrupted" });
      runningTasks.delete(id);
    }
  };


  const hardCancel = () => {
    // Hard cancel: stop narration AND show cleanup before stopping tasks.
    // When you wire real Brass: call scope.close() / interrupt fibers / abort fetch here.
    nextToken();

    note("Hard cancel requested. Running cleanup before stopping tasks…");

    const ids = Array.from(runningTasks);

    if (scopeOpen) {
      emit({ t: "scope_closed", scopeId });
      scopeOpen = false;
    }

    if (ids.length === 0) {
      note("No running tasks to cancel.");
      return;
    }

    // Step 1: move tasks into Cleanup lane (renderable intermediate state)
    for (const id of ids) {
      emit({ t: "task_state", taskId: id, state: "finalizing" });
      emit({ t: "finalizer_progress", taskId: id, ran: 0, total: 1 });
    }

    // Step 2: make cleanup visible
    window.setTimeout(() => {
      for (const id of ids) {
        emit({ t: "finalizer_progress", taskId: id, ran: 1, total: 1 });
      }
    }, 250);

    // Step 3: after cleanup, stop tasks
    window.setTimeout(() => {
      for (const id of ids) {
        emit({ t: "task_state", taskId: id, state: "interrupted" });
        runningTasks.delete(id);
      }
      note("Hard cancel complete.");
    }, 550);
  };


  const demoSimpleCalls = fromPromiseAbortable(
    async (signal) => {
      const respuesta = await fetch("https://jsonplaceholder.typicode.com/posts/1", { signal });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const body = (await respuesta.json()) as Post;
      return { status: respuesta.status, body };
    },
    (e) => e
  );

  const demoSimpleCalls404 = fromPromiseAbortable(
    async (signal) => {
      const respuesta = await fetch("https://jsonplaceholder.typicode.com/posts/123456", { signal });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const body = (await respuesta.json()) as Post;
      return { status: respuesta.status, body };
    },
    (e) => e
  );

  async function runSimpleGet() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;

    note("Scenario: wrap native fetch in a cancelable Effect (fromPromiseAbortable).");
    note("fetch does NOT throw on HTTP 4xx/5xx — we choose to convert non-ok into an error.");

    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/1 (fetch)") });
    runningTasks.add(taskId);

    await sleep(250);
    if (isStale(t)) return;

    note("Starting request… (Try Hard cancel while it runs)");
    try {
      const r = await toPromise(demoSimpleCalls as any, env);
      if (isStale(t)) return;
      const s = summarizeHttp(r);
      emit({ t: "task_state", taskId, state: "done" });
      runningTasks.delete(taskId);
      note(`Completed: status=${s.status} id=${s.id ?? "-"} (no meta ms here)`);
    } catch (e: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      runningTasks.delete(taskId);
      note(`Failed: ${String(e)}`);
    }
  }

  async function runSimpleGet404() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;

    note("Scenario: GET that returns 404. fetch resolves, but ok=false, so we throw.");
    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/123456 (404)") });
    runningTasks.add(taskId);

    await sleep(250);
    if (isStale(t)) return;

    try {
      const r = await toPromise(demoSimpleCalls404 as any, env);
      if (isStale(t)) return;
      const s = summarizeHttp(r);
      emit({ t: "task_state", taskId, state: "done" });
      runningTasks.delete(taskId);
      note(`Unexpected success: status=${s.status} id=${s.id ?? "-"}`);
    } catch (e: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      runningTasks.delete(taskId);
      note(`As expected: thrown error → ${String(e)}`);
    }
  }

  async function runMetaGet() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;

    note("Scenario: use httpClientWithMeta to get status + durationMs.");
    const http = httpClientWithMeta({ baseUrl: "https://jsonplaceholder.typicode.com" });

    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/1 (with meta)") });
    runningTasks.add(taskId);

    await sleep(200);
    if (isStale(t)) return;

    try {
      const r = await toPromise(http.getJson<Post>("/posts/1") as any, env);
      if (isStale(t)) return;
      const s = summarizeHttp(r);
      emit({ t: "task_state", taskId, state: "done" });
      runningTasks.delete(taskId);
      note(`Completed: status=${s.status} ms=${s.ms ?? "-"} id=${s.id ?? "-"}`);
      note("In withMeta, you get both the parsed response and the raw wire info (including duration).");
    } catch (e: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      runningTasks.delete(taskId);
      note(`Failed: ${String(e)}`);
    }
  }

  async function runMetaPost() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;

    note("Scenario: POST JSON with meta (status + durationMs + returned id).");
    const http = httpClientWithMeta({ baseUrl: "https://jsonplaceholder.typicode.com" });
    const postBody: NewPost = { title: "foo", body: "bar", userId: 1 };

    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "POST /posts (with meta)") });
    runningTasks.add(taskId);

    await sleep(200);
    if (isStale(t)) return;

    try {
      const r = await toPromise(http.postJson("/posts", postBody, { headers: { accept: "application/json" } }) as any, env);
      if (isStale(t)) return;
      const s = summarizeHttp(r);
      emit({ t: "task_state", taskId, state: "done" });
      runningTasks.delete(taskId);
      note(`Completed: status=${s.status} ms=${s.ms ?? "-"} id=${s.id ?? "-"}`);
      note("Note: jsonplaceholder is a fake API — it returns a synthetic id.");
    } catch (e: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      runningTasks.delete(taskId);
      note(`Failed: ${String(e)}`);
    }
  }

  async function runParWithScope() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;

    note("Scenario: run two POST requests in parallel using withScope + zipPar.");
    note("Structured concurrency: both tasks belong to the same parent scope.");

    const http = httpClientWithMeta({ baseUrl: "https://jsonplaceholder.typicode.com" });
    const postBody: NewPost = { title: "foo", body: "bar", userId: 1 };

    const e1 = http.postJson("/posts", postBody, { headers: { accept: "application/json" } });
    const e2 = http.postJson("/posts", postBody, { headers: { accept: "application/json" } });

    emit({ t: "task_created", task: mkTask("F1", scopeId, "POST /posts #1") });
    runningTasks.add("F1");
    emit({ t: "task_created", task: mkTask("F2", scopeId, "POST /posts #2") });
    runningTasks.add("F2");

    await sleep(250);
    if (isStale(t)) return;

    note("zipPar forks both tasks and waits for both results.");
    try {
      const program = withScope((parentScope: any) => zipPar(e1 as any, e2 as any, parentScope));
      const [r1, r2] = await toPromise(program as any, env);
      if (isStale(t)) return;

      const s1 = summarizeHttp(r1);
      const s2 = summarizeHttp(r2);

      emit({ t: "task_state", taskId: "F1", state: "done" }); runningTasks.delete("F1");
      emit({ t: "task_state", taskId: "F2", state: "done" }); runningTasks.delete("F2");

      note(`F1: status=${s1.status} ms=${s1.ms ?? "-"} id=${s1.id ?? "-"}`);
      note(`F2: status=${s2.status} ms=${s2.ms ?? "-"} id=${s2.id ?? "-"}`);
      note("withScope handles the scope lifetime automatically.");
    } catch (e: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId: "F1", state: "failed" }); runningTasks.delete("F1");
      emit({ t: "task_state", taskId: "F2", state: "failed" }); runningTasks.delete("F2");
      note(`Parallel program failed: ${String(e)}`);
      note("Depending on zipPar semantics, a failure may cancel sibling tasks.");
    }
  }

  async function runParManualScope() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;

    note("Scenario: same parallel POSTs, but scope is managed manually (try/finally).");
    note("Manual scope guarantees close() runs even if something throws.");

    const http = httpClientWithMeta({ baseUrl: "https://jsonplaceholder.typicode.com" });
    const postBody: NewPost = { title: "foo", body: "bar", userId: 1 };
    const e1 = http.postJson("/posts", postBody, { headers: { accept: "application/json" } });
    const e2 = http.postJson("/posts", postBody, { headers: { accept: "application/json" } });

    emit({ t: "task_created", task: mkTask("F1", scopeId, "POST /posts #1") }); runningTasks.add("F1");
    emit({ t: "task_created", task: mkTask("F2", scopeId, "POST /posts #2") }); runningTasks.add("F2");

    await sleep(200);
    if (isStale(t)) return;

    const parentScope = new Scope(env);
    try {
      const program = zipPar(e1 as any, e2 as any, parentScope);
      const [r1, r2] = await toPromise(program as any, env);
      if (isStale(t)) return;

      const s1 = summarizeHttp(r1);
      const s2 = summarizeHttp(r2);

      emit({ t: "task_state", taskId: "F1", state: "done" }); runningTasks.delete("F1");
      emit({ t: "task_state", taskId: "F2", state: "done" }); runningTasks.delete("F2");

      note(`F1: status=${s1.status} ms=${s1.ms ?? "-"} id=${s1.id ?? "-"}`);
      note(`F2: status=${s2.status} ms=${s2.ms ?? "-"} id=${s2.id ?? "-"}`);
    } catch (e: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId: "F1", state: "failed" }); runningTasks.delete("F1");
      emit({ t: "task_state", taskId: "F2", state: "failed" }); runningTasks.delete("F2");
      note(`Parallel program failed: ${String(e)}`);
    } finally {
      parentScope.close();
      emit({ t: "scope_closed", scopeId });
      scopeOpen = false;
      note("finally: scope.close() ran. Any still-running work would be cancelled & cleaned up.");
    }
  }

  const run = async () => {
    if (mode === "simple:get") return runSimpleGet();
    if (mode === "simple:get404") return runSimpleGet404();
    if (mode === "meta:get") return runMetaGet();
    if (mode === "meta:post") return runMetaPost();
    if (mode === "par:withScope") return runParWithScope();
    return runParManualScope();
  };

  return { init, setMode, run, cancel, hardCancel };
}
