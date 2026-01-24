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

## Plug Brass in
The demo imports the same symbols as your example snippet:
- `fromPromiseAbortable`, `Scope`, `toPromise`, `withScopeAsync`, `zipPar`
- `httpClientWithMeta` from `"brass-runtime/http"`

Adjust imports if your public package paths differ.
