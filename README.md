# create-brass

CLI to scaffold **Brass runtime** apps with beginner-friendly, visual onboarding demos (scopes, cancellation, concurrency).

## Quick start

Generate a new project:

```bash
npm create brass@latest my-app
```

Or choose a template explicitly:

```bash
npm create brass@latest my-app -- --template=vite-react-ts
npm create brass@latest my-app -- --template=vite-vanilla-ts
```

Then:

```bash
cd my-app
npm install
npm run dev
```

> Note: `npm create` passes flags after `--` to the CLI.

## Templates

- `vite-react-ts` — Vite + React + TypeScript, scope-boxes visual demo
- `vite-vanilla-ts` — Vite + Vanilla TypeScript, scope-boxes visual demo

The generated project depends on:
- `brass-runtime`
- (optionally) `brass-runtime/http` or `brass-http` depending on your setup

## What you get

The templates ship with:
- a visual “Scope boxes” demo (scopes as containers, tasks inside, cancellation + cleanup)
- progressive explanations/events while the demo runs
- **Soft cancel** (stops the demo + moves running tasks to “Stopped”)
- **Hard cancel** (shows “Cleanup” first, then “Stopped”)

## Developing this CLI locally

Build the CLI:

```bash
npm install
npm run build
```

Run it directly:

```bash
node dist/index.js my-app --template=vite-react-ts
```

> The CLI only copies files from `templates/`. It does not require Vite/React installed globally.

## Project structure

```txt
.
├─ src/                # CLI source
├─ dist/               # compiled output (after build)
└─ templates/
   ├─ vite-react-ts/
   └─ vite-vanilla-ts/
```

## Adding a new template

1. Create a new folder under `templates/`:
    - `templates/vite-svelte-ts` (example)
2. Ensure it is a valid Vite project (package.json, vite.config.ts, index.html, src/)
3. Add it to the template list in the CLI
4. Test locally:
   ```bash
   node dist/index.js test-app --template=vite-svelte-ts
   cd test-app && npm install && npm run build
   ```

## Vite equivalents (reference)

### Vite React + TypeScript
```bash
npm create vite@latest my-app --template=vite-react-ts
cd my-app
npm install
npm run dev
```

### Vite Vanilla + TypeScript
```bash
npm create vite@latest my-app --template=vite-vanilla-ts
cd my-app
npm install
npm run dev

```

## License

MIT
