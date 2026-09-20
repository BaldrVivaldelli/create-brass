# Brass Runtime – Scope Boxes (vanilla TS template)

This folder is copied by `create-brass`.

## Run
```bash
npm install
npm run dev
```

## What you get
- A visual "scope boxes" demo without React
- Multiple scenarios:
  - cancelable fetch (ok + 404 error)
  - Brass HTTP with meta (GET/POST)
  - parallel POST ×2 with withScopeAsync+zipPar
  - parallel POST ×2 with manual Scope+zipPar (try/finally close)

## Controls
- **Hard cancel**: marks running tasks as cancelled and shows cleanup.
- **Cancel (soft)**: stops the progressive narration (no forced cancellation).

## Brass API boundary

`src/runtime/brass.ts` is the reversible application facade. Most runtime
concepts come from the additive `brass-runtime/next` preview; `zipPar` remains
on the supported v1 root until the preview has an evidence-backed replacement.
HTTP stays on `brass-runtime/http`.

To roll back the preview, replace only that facade with equivalent stable-root
exports and a small `Effect.fromPromiseAbortable` adapter; no call-site, data,
or state migration is required.
