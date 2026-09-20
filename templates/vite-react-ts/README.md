# Brass Runtime – HTTP (template)

This folder is copied by `create-brass`.

## Run
```bash
npm install
npm run dev
```

## What you get
A visual, beginner-friendly onboarding demo:
- scopes are boxes (containers for work)
- tasks (fibers/effects) run inside scopes
- the **Events** panel explains what is happening progressively while the demo runs

## Scenarios included
- Simple GET wrapped with `Effect.fromPromiseAbortable` (cancel via AbortSignal)
- GET 404 converted into error (because fetch doesn’t throw)
- GET with meta (durationMs)
- POST with meta (id + durationMs)
- Parallel POST ×2 with `withScopeAsync + zipPar`
- Parallel POST ×2 with manual `new Scope(runtime) ... finally close()`

## Brass API boundary

`src/runtime/brass.ts` is the reversible application facade. Most runtime
concepts come from the additive `brass-runtime/next` preview; `zipPar` remains
on the supported v1 root until the preview has an evidence-backed replacement.
HTTP stays on `brass-runtime/http`.

To roll back the preview, replace only that facade with equivalent stable-root
exports and a small `Effect.fromPromiseAbortable` adapter; no call-site, data,
or state migration is required.
