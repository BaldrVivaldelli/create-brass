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
- Simple GET wrapped with `fromPromiseAbortable` (cancel via AbortSignal)
- GET 404 converted into error (because fetch doesn’t throw)
- GET with meta (durationMs)
- POST with meta (id + durationMs)
- Parallel POST ×2 with `withScopeAsync + zipPar`
- Parallel POST ×2 with manual `new Scope(env) ... finally close()`

## Where to plug Brass in
- `src/runtime/demoCases.ts` uses the same imports as your example snippet:
  - `fromPromiseAbortable`, `Scope`, `toPromise`, `withScope`, `zipPar`
  - `httpClient`, `httpClientWithMeta`
Adjust paths/types if your package exports differ.
