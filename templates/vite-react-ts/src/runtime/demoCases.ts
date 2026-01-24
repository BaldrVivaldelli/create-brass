import type { Task, TourEvent } from "../types";

// Use your real exports (these match your example snippet).
// NOTE: withScopeAsync is the safe variant for Async/Effect-returning bodies.
import { fromPromiseAbortable, Scope, toPromise, withScopeAsync, zipPar } from "brass-runtime";
import { httpClient, httpClientWithMeta } from "brass-runtime/http";

type Env = any;

type Post = { id: number; userId: number; title: string; body: string };
type NewPost = Omit<Post, "id">;

const baseUrl = "https://jsonplaceholder.typicode.com";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function mkTask(id: string, scopeId: string, label: string): Task {
  return { id, scopeId, label, state: "running", finalizers: undefined };
}

function safeJson(bodyText: string) {
  try { return JSON.parse(bodyText); } catch { return undefined; }
}

/** Works with both httpClient (simple) and httpClientWithMeta (wire/meta/response). */
function summarize(label: string, x: any) {
  const status = x?.status ?? x?.wire?.status ?? x?.response?.status;
  const ms = x?.ms ?? x?.wire?.ms ?? x?.meta?.durationMs;
  const body = x?.body ?? x?.response?.body;
  const id = body?.id ?? safeJson(x?.bodyText ?? x?.wire?.bodyText ?? "")?.id;
  return { label, status, ms, id };
}

export type DemoController = {
  init: () => void;
  runSimpleGet: () => Promise<void>;
  runSimpleGet404: () => Promise<void>;
  runMetaGet: () => Promise<void>;
  runMetaPost: () => Promise<void>;
  runParWithScope: () => Promise<void>;
  runParManualScope: () => Promise<void>;
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

  const nextToken = () => ++runToken;
  const isStale = (t: number) => t !== runToken;

  const note = (message: string) => emit({ t: "note", message });

  const init = () => {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    note("This scope is a container for work. Tasks created inside can be cleaned up together.");
    note("Pick a scenario below. You’ll see tasks move across states and explanations appear progressively.");
    if (isStale(t)) return;
  };

  const cancel = () => {
    // Soft cancel: stop the demo script/narration AND visibly stop running tasks.
    // No cleanup phase here (that's what hardCancel is for).
    nextToken();
    note("Cancel requested. (Soft-cancel: stop the demo now — no cleanup.)");

    for (const id of Array.from(runningTasks)) {
      emit({ t: "task_state", taskId: id, state: "interrupted" });
      runningTasks.delete(id);
    }
  };

  const hardCancel = () => {
  // Stop any pending scripted steps (like soft cancel does)
  nextToken();

  emit({ t: "note", message: "Hard cancel: running cleanup before stopping tasks…" });

  const ids = Array.from(runningTasks);
  if (ids.length === 0) {
    emit({ t: "note", message: "No running tasks to cancel." });
    return;
  }

  // Step 1: move tasks into Cleanup lane
  for (const id of ids) {
    emit({ t: "task_state", taskId: id, state: "finalizing" });
    emit({ t: "finalizer_progress", taskId: id, ran: 0, total: 1 });
  }

  // Step 2: make cleanup visible (render an intermediate frame)
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
    emit({ t: "note", message: "Hard cancel complete." });
  }, 550);
};

  async function runSimpleGet() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/1 (abortable fetch)")  });
    runningTasks.add(mkTask(taskId, scopeId, "GET /posts/1 (abortable fetch)") .id);
    note("Scenario: wrapping native fetch with fromPromiseAbortable so it can be cancelled via AbortSignal.");
    await sleep(250); if (isStale(t)) return;

    const demoSimpleCalls = fromPromiseAbortable(
      async (signal) => {
        // Optional: small artificial delay so Cancel has time to happen in demos.
        for (let i = 0; i < 20; i++) {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          await new Promise((r) => setTimeout(r, 50));
        }

        const r = await fetch(`${baseUrl}/posts/1`, { signal });
        // fetch does NOT throw on 4xx/5xx; we choose to treat non-ok as error.
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as Post;
        return { status: r.status, body };
      },
      (e) => e
    );

    note("Starting request…");
    await sleep(250); if (isStale(t)) return;

    try {
      const res = await toPromise(demoSimpleCalls, env);
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "done" });
      const s = summarize("simple GET", res);
      note(`✅ Completed: status=${s.status} id=${s.id ?? "-"}${s.ms ? ` (${s.ms}ms)` : ""}`);
      note("Key idea: AbortSignal enables real cancellation of in-flight fetch.");
    } catch (err: any) {
      if (isStale(t)) return;
      const aborted = String(err?.name ?? err).includes("Abort");
      emit({ t: "task_state", taskId, state: aborted ? "interrupted" : "failed" });
      note(aborted ? "🛑 Aborted via AbortSignal." : `❌ Failed: ${String(err)}`);
    }
  }

  async function runSimpleGet404() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/999999 (404 -> error)")  });
    runningTasks.add(mkTask(taskId, scopeId, "GET /posts/999999 (404 -> error)") .id);
    note("Scenario: fetch does NOT throw for 404/500. We convert non-ok into an error explicitly.");
    await sleep(250); if (isStale(t)) return;

    const eff = fromPromiseAbortable(
      async (signal) => {
        const r = await fetch(`${baseUrl}/posts/999999`, { signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as Post;
        return { status: r.status, body };
      },
      (e) => e
    );

    note("Starting request…");
    await sleep(200); if (isStale(t)) return;

    try {
      const res = await toPromise(eff, env);
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "done" });
      const s = summarize("GET 404", res);
      note(`✅ Completed unexpectedly: status=${s.status} id=${s.id ?? "-"}`);
    } catch (err: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      note(`❌ Expected failure: ${String(err)}`);
      note("Key idea: you decide whether non-2xx is success or failure.");
    }
  }

  async function runMetaGet() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    const http = httpClientWithMeta({ baseUrl });

    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/1 (with meta)")  });
    runningTasks.add(mkTask(taskId, scopeId, "GET /posts/1 (with meta)") .id);

    note("Scenario: httpClientWithMeta returns { wire, response, meta } so you can show durationMs, status, etc.");
    await sleep(200); if (isStale(t)) return;

    try {
      note("Starting request…");
      const res = await toPromise(http.getJson<Post>("/posts/1"), env);
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "done" });
      const s = summarize("meta GET", res);
      note(`✅ Completed: status=${s.status} id=${s.id ?? "-"} (${s.ms ?? res?.meta?.durationMs ?? "-"}ms)`);
      note("Key idea: meta makes performance visible without changing your business result type.");
    } catch (err: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      note(`❌ Failed: ${String(err)}`);
    }
  }

  async function runMetaPost() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    const http = httpClientWithMeta({ baseUrl });

    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "POST /posts (with meta)")  });
    runningTasks.add(mkTask(taskId, scopeId, "POST /posts (with meta)") .id);

    const postBody: NewPost = { title: "foo", body: "bar", userId: 1 };

    note("Scenario: POST JSON and show returned id + durationMs.");
    await sleep(200); if (isStale(t)) return;

    try {
      note("Sending request…");
      const res = await toPromise(
        http.postJson<Post>("/posts", postBody, { headers: { accept: "application/json" } }),
        env
      );
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "done" });
      const s = summarize("meta POST", res);
      note(`✅ Completed: status=${s.status} id=${s.id ?? "-"} (${s.ms ?? "-"}ms)`);
      note("Note: JSONPlaceholder fakes writes, but it’s perfect for demos.");
    } catch (err: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId, state: "failed" });
      note(`❌ Failed: ${String(err)}`);
    }
  }

  async function runParWithScope() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    const http = httpClientWithMeta({ baseUrl });
    const postBody: NewPost = { title: "foo", body: "bar", userId: 1 };

    const task1 = "F1";
    const task2 = "F2";

    emit({ t: "task_created", task: mkTask(task1, scopeId, "POST /posts #1 (zipPar)")  });
    runningTasks.add(mkTask(task1, scopeId, "POST /posts #1 (zipPar)") .id);
    emit({ t: "task_created", task: mkTask(task2, scopeId, "POST /posts #2 (zipPar)")  });
    runningTasks.add(mkTask(task2, scopeId, "POST /posts #2 (zipPar)") .id);

    note("Scenario: zipPar runs two effects concurrently and waits for both.");
    note("withScopeAsync creates and manages the parent scope automatically.");
    await sleep(250); if (isStale(t)) return;

    const e1 = http.postJson<Post>("/posts", postBody, { headers: { accept: "application/json" } });
    const e2 = http.postJson<Post>("/posts", postBody, { headers: { accept: "application/json" } });

    try {
      note("Forking both requests…");
      const program = withScopeAsync((parentScope: any) => zipPar(e1, e2, parentScope));
      const [r1, r2] = await toPromise(program, env);
      if (isStale(t)) return;

      emit({ t: "task_state", taskId: task1, state: "done" });
    runningTasks.delete(task1);
      emit({ t: "task_state", taskId: task2, state: "done" });
    runningTasks.delete(task2);

      const s1 = summarize("r1", r1);
      const s2 = summarize("r2", r2);
      note(`✅ Both done: r1 status=${s1.status} id=${s1.id ?? "-"} (${s1.ms ?? "-"}ms)`);
      note(`✅ Both done: r2 status=${s2.status} id=${s2.id ?? "-"} (${s2.ms ?? "-"}ms)`);
      note("Key idea: structured concurrency keeps parallel work bounded to a scope.");
    } catch (err: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId: task1, state: "failed" });
    runningTasks.delete(task1);
      emit({ t: "task_state", taskId: task2, state: "failed" });
    runningTasks.delete(task2);
      note(`❌ zipPar failed: ${String(err)}`);
      note("Depending on your zipPar semantics, siblings may be cancelled when one fails.");
    }
  }

  async function runParManualScope() {
    const t = nextToken();
    emit({ t: "scope_created", scopeId, label: "HTTP scope" });
    scopeOpen = true;
    const http = httpClientWithMeta({ baseUrl });
    const postBody: NewPost = { title: "foo", body: "bar", userId: 1 };

    const task1 = "F1";
    const task2 = "F2";

    emit({ t: "task_created", task: mkTask(task1, scopeId, "POST /posts #1 (manual scope)")  });
    runningTasks.add(mkTask(task1, scopeId, "POST /posts #1 (manual scope)") .id);
    emit({ t: "task_created", task: mkTask(task2, scopeId, "POST /posts #2 (manual scope)")  });
    runningTasks.add(mkTask(task2, scopeId, "POST /posts #2 (manual scope)") .id);

    note("Scenario: same as parallel zipPar, but you manage Scope lifetime manually.");
    note("Pattern: const s = new Scope(env); try { ... } finally { s.close(); }");
    await sleep(250); if (isStale(t)) return;

    const e1 = http.postJson<Post>("/posts", postBody, { headers: { accept: "application/json" } });
    const e2 = http.postJson<Post>("/posts", postBody, { headers: { accept: "application/json" } });

    const parentScope = new Scope(env);
    try {
      note("Forking both requests…");
      const program = zipPar(e1, e2, parentScope);
      const [r1, r2] = await toPromise(program, env);
      if (isStale(t)) return;

      emit({ t: "task_state", taskId: task1, state: "done" });
    runningTasks.delete(task1);
      emit({ t: "task_state", taskId: task2, state: "done" });
    runningTasks.delete(task2);

      const s1 = summarize("r1", r1);
      const s2 = summarize("r2", r2);
      note(`✅ Both done: r1 status=${s1.status} id=${s1.id ?? "-"} (${s1.ms ?? "-"}ms)`);
      note(`✅ Both done: r2 status=${s2.status} id=${s2.id ?? "-"} (${s2.ms ?? "-"}ms)`);
      note("Key idea: manual scope gives you explicit lifecycle control (useful in lower-level code).");
    } catch (err: any) {
      if (isStale(t)) return;
      emit({ t: "task_state", taskId: task1, state: "failed" });
    runningTasks.delete(task1);
      emit({ t: "task_state", taskId: task2, state: "failed" });
    runningTasks.delete(task2);
      note(`❌ zipPar failed: ${String(err)}`);
    } finally {
      parentScope.close();
      emit({ t: "scope_closed", scopeId });
    scopeOpen = false;
      note("Scope closed (finally). In real Brass, this is where cleanup/finalizers run.");
    }
  }

  return {
    init,
    runSimpleGet,
    runSimpleGet404,
    runMetaGet,
    runMetaPost,
    runParWithScope,
    runParManualScope,
    cancel,
    hardCancel
  };
}
