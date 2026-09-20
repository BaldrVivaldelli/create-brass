#!/usr/bin/env node

import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const templates = ["vite-react-ts", "vite-vanilla-ts"];
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function argumentValue(name) {
  const inline = process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const requestedTarball = argumentValue("--runtime-tarball");
const runtimeTarball = requestedTarball ? resolve(requestedTarball) : undefined;
const stableFacade = process.argv.includes("--stable-facade");
const betaFacade = process.argv.includes("--beta-facade");
const v1Facade = process.argv.includes("--v1-facade");
if ([stableFacade, betaFacade, v1Facade].filter(Boolean).length > 1) {
  throw new Error("Choose only one facade override");
}
const stableFacadeSource = `// Rollback adapter generated only in the staged validation copy.
import { fromPromiseAbortable } from "brass-runtime";

export {
  Scope,
  makeRuntime,
  runPromise,
  withScopeAsync,
  zipPar
} from "brass-runtime";

export const Effect = Object.freeze({ fromPromiseAbortable });
`;
const betaFacadeSource = `// V2 beta adapter generated only in the staged validation copy.
export {
  Effect,
  Scope,
  makeRuntime,
  runPromise,
  withScopeAsync
} from "brass-runtime";

export { zipPar } from "brass-runtime/core";
`;
const v1FacadeSource = `// Beta /v1 bridge generated only in the staged validation copy.
import { fromPromiseAbortable } from "brass-runtime/v1";

export {
  Scope,
  makeRuntime,
  runPromise,
  withScopeAsync,
  zipPar
} from "brass-runtime/v1";

export const Effect = Object.freeze({ fromPromiseAbortable });
`;
if (runtimeTarball && !existsSync(runtimeTarball)) {
  throw new Error(`Runtime tarball does not exist: ${runtimeTarball}`);
}
if (v1Facade && !runtimeTarball) {
  throw new Error("--v1-facade requires --runtime-tarball pointing to a v2 beta candidate");
}
if (betaFacade && !runtimeTarball) {
  throw new Error("--beta-facade requires --runtime-tarball pointing to a v2 beta candidate");
}

function run(args, cwd) {
  const result = spawnSync(npmCommand, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${npmCommand} ${args.join(" ")} failed in ${basename(cwd)} with status ${result.status}`);
  }
}

const stagingRoot = mkdtempSync(join(tmpdir(), "create-brass-templates-"));

try {
  for (const template of templates) {
    const source = realpathSync(resolve("templates", template));
    const staged = join(stagingRoot, template);
    cpSync(source, staged, { recursive: true });

    const manifestPath = join(staged, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.name = `create-brass-smoke-${template}`;
    if (runtimeTarball) manifest.dependencies["brass-runtime"] = `file:${runtimeTarball}`;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    if (stableFacade) {
      writeFileSync(join(staged, "src", "runtime", "brass.ts"), stableFacadeSource);
    } else if (betaFacade) {
      writeFileSync(join(staged, "src", "runtime", "brass.ts"), betaFacadeSource);
    } else if (v1Facade) {
      writeFileSync(join(staged, "src", "runtime", "brass.ts"), v1FacadeSource);
    }

    const facadeLabel = stableFacade
      ? " using the stable v1 facade"
      : betaFacade
        ? " using the v2 beta facade"
        : v1Facade
          ? " using the beta /v1 bridge"
          : "";
    console.log(`\nValidating ${template}${runtimeTarball ? ` with ${basename(runtimeTarball)}` : ""}${facadeLabel}...`);
    run(["install", "--ignore-scripts", "--no-audit", "--no-fund"], staged);
    run(["audit", "--audit-level=high"], staged);
    run(["run", "build"], staged);
  }

  console.log("\nAll create-brass templates built successfully.");
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}
