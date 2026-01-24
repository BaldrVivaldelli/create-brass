import type { Task, ScopeId, TaskState } from "../types";

type Props = {
  width?: number;
  height?: number;
  scope: { id: ScopeId; label: string; isClosed: boolean } | null;
  tasks: Task[];
};

const STATE_META: Record<TaskState, { label: string }> = {
  running: { label: "Running" },
  finalizing: { label: "Cleanup" },
  done: { label: "Done" },
  failed: { label: "Failed" },
  interrupted: { label: "Stopped" }
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
  return Math.min(w - pad, lanes[state] ?? lanes.running);
}

function yForIndex(i: number) {
  return 150 + i * 62;
}

function nodeTitle(t: Task) {
  const fx = t.finalizers;
  const cleanup = fx ? ` • cleanup ${fx.ran}/${fx.total}` : "";
  return `${t.label}${cleanup}`;
}

export default function ScopeBoxesCanvas({ width = 740, height = 520, scope, tasks }: Props) {
  const w = width;
  const h = height;

  const scopeRect = {
    x: 40,
    y: 120,
    w: 560,
    h: 260
  };

  const activeTasks = tasks
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Scope boxes visualization">
      {/* Lanes */}
      <Lane x={laneX("running", w)} label="Running (in scope)" />
      <Lane x={laneX("finalizing", w)} label="Cleanup" />
      <Lane x={laneX("interrupted", w)} label="Stopped" />
      <Lane x={laneX("done", w)} label="Done" />

      {/* Scope box */}
      {scope ? (
        <g>
          <rect
            x={scopeRect.x}
            y={scopeRect.y}
            width={scopeRect.w}
            height={scopeRect.h}
            rx={18}
            fill="white"
            stroke={scope.isClosed ? "#fecaca" : "#c7d2fe"}
            strokeWidth={2}
          />
          <text x={scopeRect.x + 16} y={scopeRect.y - 12} fontSize="13" fill="#374151">
            {scope.label} ({scope.id})
          </text>
        </g>
      ) : null}

      {/* Tasks */}
      {activeTasks.map((t, idx) => {
        const x = laneX(t.state, w);
        const y = yForIndex(idx);
        const inScope = t.state === "running" || t.state === "finalizing";
        const isDanger = t.state === "interrupted" || t.state === "failed";
        const isDone = t.state === "done";
        return (
          <g key={t.id} style={{ transition: "transform 500ms ease" }} transform={`translate(${x}, ${y})`}>
            {/* connector into scope */}
            {inScope && scope ? (
              <line
                x1={-80}
                y1={0}
                x2={-20}
                y2={0}
                stroke="#e5e7eb"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : null}

            <circle r={16} fill={isDone ? "#f3f4f6" : isDanger ? "#fff1f2" : "#eef2ff"} stroke="#e5e7eb" />
            <text x={0} y={4} textAnchor="middle" fontSize="11" fill="#111827">
              {t.id}
            </text>

            <text x={28} y={4} fontSize="13" fill="#111827">
              {nodeTitle(t)}
            </text>

            <text x={28} y={22} fontSize="12" fill="#6b7280">
              {STATE_META[t.state].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Lane({ x, label }: { x: number; label: string }) {
  return (
    <g>
      <line x1={x} y1={70} x2={x} y2={500} stroke="#eef2f7" strokeWidth={2} />
      <text x={x} y={52} textAnchor="middle" fontSize="12" fill="#6b7280">
        {label}
      </text>
    </g>
  );
}
