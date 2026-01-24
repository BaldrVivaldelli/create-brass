import {toPromise} from "brass-runtime";
import {httpClient} from "brass-runtime/http";
import {Task, TourEvent} from "../types";

/**
 * Real HTTP demo using brass-http + brass-runtime's toPromise.
 * Adjust imports / response shapes to match your packages.
 */
type Env = any;

type Post = { userId: number; id: number; title: string; body: string };

function mkTask(id: string, scopeId: string, label: string): Task {
  return { id, scopeId, label, state: "running", finalizers: undefined };
}

export function createHttpDemo(emit: (e: TourEvent) => void) {
  const scopeId = "S1";
  const env: Env = {};

  // Create a "scope" in the UI (purely visual for now).
  emit({ t: "scope_created", scopeId, label: "HTTP scope" });

  const http = httpClient({
    baseUrl: "https://jsonplaceholder.typicode.com"
  });

  const unwrapBody = <T,>(r: any): T => (r?.body ?? r?.response?.body ?? r) as T;

  const getPost1 = async () => {
    const taskId = "F1";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "GET /posts/1") });
    emit({ t: "note", message: "Fetching a post…" });

    try {
      const res = await toPromise(http.getJson<Post>("/posts/1") as any, env);
      const body = unwrapBody<Post>(res);
      emit({ t: "task_state", taskId, state: "done" });
      emit({ t: "note", message: `✅ title: ${body.title}` });
    } catch (err) {
      emit({ t: "task_state", taskId, state: "failed" });
      emit({ t: "note", message: `❌ GET failed: ${String(err)}` });
    }
  };

  const createPost = async () => {
    const taskId = "F2";
    emit({ t: "task_created", task: mkTask(taskId, scopeId, "POST /posts") });
    emit({ t: "note", message: "Creating a post…" });

    const payload = {
      userId: 1,
      title: "Hola Brass",
      body: "Probando POST desde Brass HTTP client"
    };

    try {
      const res = await toPromise(http.postJson<Post>("/posts", payload) as any, env);
      const body = unwrapBody<Post>(res);
      emit({ t: "task_state", taskId, state: "done" });
      emit({ t: "note", message: `✅ created id: ${body.id}` });
    } catch (err) {
      emit({ t: "task_state", taskId, state: "failed" });
      emit({ t: "note", message: `❌ POST failed: ${String(err)}` });
    }
  };

  return { getPost1, createPost };
}
