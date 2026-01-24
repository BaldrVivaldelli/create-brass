import type { Task, TaskState } from "../types";

type ScopeView = { id: string; label: string };

const STATE_LABEL: Record<TaskState, string> = {
  running: "Running",
  finalizing: "Cleanup",
  done: "Done",
  failed: "Failed",
  interrupted: "Stopped"
};

function laneX(state: TaskState, w: number) {
  const pad = 26;
  const lanes = {
    running: pad + 120,
    finalizing: pad + 320,
    interrupted: pad + 520,
    done: pad + 720,
    failed: pad + 720
  } as const;
  return Math.min(w - pad, (lanes as any)[state] ?? lanes.running);
}

function yForIndex(i: number) {
  return 150 + i * 62;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nodeTitle(t: Task) {
  const fx = t.finalizers;
  const cleanup = fx ? ` • cleanup ${fx.ran}/${fx.total}` : "";
  return `${t.label}${cleanup}`;
}

export function renderScopeBoxesCanvas(opts: {
  width?: number;
  height?: number;
  scope: ScopeView | null;
  tasks: Task[];
}): string {
  const w = opts.width ?? 740;
  const h = opts.height ?? 520;
  const scope = opts.scope;
  const tasks = opts.tasks.slice().sort((a, b) => a.id.localeCompare(b.id));

  const scopeRect = { x: 40, y: 120, w: 560, h: 260 };

  const lane = (x: number, label: string) => `
    <g>
      <line x1="${x}" y1="70" x2="${x}" y2="500" stroke="#eef2f7" stroke-width="2"></line>
      <text x="${x}" y="52" text-anchor="middle" font-size="12" fill="#6b7280">${esc(label)}</text>
    </g>
  `;

  const scopeBox = scope
    ? `
      <g>
        <rect x="${scopeRect.x}" y="${scopeRect.y}" width="${scopeRect.w}" height="${scopeRect.h}"
              rx="18" fill="white" stroke="#c7d2fe" stroke-width="2"></rect>
        <text x="${scopeRect.x + 16}" y="${scopeRect.y - 12}" font-size="13" fill="#374151">
          ${esc(scope.label)} (${esc(scope.id)})
        </text>
      </g>
    `
    : "";

  const nodes = tasks
    .map((t, idx) => {
      const x = laneX(t.state, w);
      const y = yForIndex(idx);
      const inScope = t.state === "running" || t.state === "finalizing";
      const isDanger = t.state === "interrupted" || t.state === "failed";
      const isDone = t.state === "done";
      const fill = isDone ? "#f3f4f6" : isDanger ? "#fff1f2" : "#eef2ff";

      const connector = inScope && scope
        ? `<line x1="${x-80}" y1="${y}" x2="${x-20}" y2="${y}" stroke="#e5e7eb" stroke-width="2" stroke-linecap="round"></line>`
        : "";

      return `
        <g style="transition: transform 500ms ease;" transform="translate(${x}, ${y})">
          <circle r="16" fill="${fill}" stroke="#e5e7eb"></circle>
          <text x="0" y="4" text-anchor="middle" font-size="11" fill="#111827">${esc(t.id)}</text>
          <text x="28" y="4" font-size="13" fill="#111827">${esc(nodeTitle(t))}</text>
          <text x="28" y="22" font-size="12" fill="#6b7280">${esc(STATE_LABEL[t.state])}</text>
        </g>
      `.trim() + connector;
    })
    .join("\n");

  return `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Scope boxes visualization">
    ${lane(laneX("running", w), "Running (in scope)")}
    ${lane(laneX("finalizing", w), "Cleanup")}
    ${lane(laneX("interrupted", w), "Stopped")}
    ${lane(laneX("done", w), "Done")}
    ${scopeBox}
    ${nodes}
  </svg>
  `.trim();
}
