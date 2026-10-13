#!/usr/bin/env node

import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const releaseConfig = JSON.parse(readFileSync(new URL("../.releaserc.json", import.meta.url), "utf8"));
const stableWorkflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const betaWorkflow = readFileSync(new URL("../.github/workflows/publish-beta.yml", import.meta.url), "utf8");
const qualityWorkflow = readFileSync(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8");
const failures = [];

if (manifest.version !== lockfile.version || manifest.version !== lockfile.packages?.[""]?.version) {
  failures.push("package and lockfile versions must match");
}
if (JSON.stringify(releaseConfig.branches) !== JSON.stringify(["main"])) {
  failures.push("stable semantic release must remain main-only");
}

for (const fragment of [
  "workflow_dispatch:",
  "github.ref == 'refs/heads/main' && inputs.publish",
  "environment: npm-stable",
  "id-token: write",
  "npm install --global npm@11.5.1",
  "npm run audit:prod",
  "npm run validate:release-policy",
  "npm run validate:evidence",
  "npm run test:evidence",
  "--package semantic-release@25.0.9",
]) {
  if (!stableWorkflow.includes(fragment)) failures.push(`stable release workflow is missing: ${fragment}`);
}
// main only takes pull requests, with required checks enforced for admins
// too, so a release that pushes a version commit fails before it publishes.
// The Git tag and npm `latest` are the released version; the changelog plugin
// only wrote a file for the Git plugin to commit.
const pluginName = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);
for (const forbidden of ["@semantic-release/git", "@semantic-release/changelog"]) {
  if ((releaseConfig.plugins ?? []).some((plugin) => pluginName(plugin) === forbidden)) {
    failures.push(`stable semantic release must not use ${forbidden}: main only takes pull requests`);
  }
  if (stableWorkflow.includes(`--package ${forbidden}@`)) {
    failures.push(`stable release workflow must not install ${forbidden}`);
  }
}
// semantic-release and its plugins pull in advisories with no patched release
// (braces via micromatch, the npm CLI's bundled deps), so they stay pinned in
// the release job and out of the audited lockfile.
const releaseTooling = (name) => name === "semantic-release" || name.startsWith("@semantic-release/");
for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const name of Object.keys(manifest[section] ?? {}).filter(releaseTooling)) {
    failures.push(`${name} must stay pinned in the release job, not in package.json ${section}`);
  }
}
for (const key of Object.keys(lockfile.packages ?? {})) {
  const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
  if (releaseTooling(name)) failures.push(`lockfile must not contain release tooling: ${key}`);
}
for (const forbidden of ["secrets.NPM_TOKEN", "NODE_AUTH_TOKEN"]) {
  if (stableWorkflow.includes(forbidden)) failures.push(`stable workflow must use trusted publishing, not: ${forbidden}`);
}
if (/^\s*push:/m.test(stableWorkflow)) {
  failures.push("stable release must not publish automatically on every main push");
}

for (const fragment of [
  "workflow_dispatch:",
  "type: boolean",
  "group: create-brass-beta-${{ github.ref }}",
  "environment: npm-next",
  "id-token: write",
  "node-version: 22",
  "npm install --global npm@11.5.1",
  "npm run audit:prod",
  "npm run validate:evidence",
  "npm run test:evidence",
  "brass-runtime@2.0.0-beta.0",
  "node scripts/prepare-beta.mjs \"$BETA_VERSION\" --write",
  "--dry-run --access public --tag next --json",
  "--access public --tag next --provenance",
  "test \"$(npm --version)\" = \"11.5.1\"",
  "for attempt in {1..20}",
  "sleep 15",
  "dist-tags.next",
  "dist-tags.latest",
  "actions/upload-artifact@v7",
  "actions/download-artifact@v8",
]) {
  if (!betaWorkflow.includes(fragment)) failures.push(`beta workflow is missing: ${fragment}`);
}
for (const forbidden of ["npm whoami", "secrets.NPM_TOKEN", "NODE_AUTH_TOKEN"]) {
  if (betaWorkflow.includes(forbidden)) failures.push(`beta workflow must use trusted publishing, not: ${forbidden}`);
}
if (betaWorkflow.includes("npm publish") && !betaWorkflow.includes("if: ${{ inputs.publish }}")) {
  failures.push("beta publication must remain explicitly opt-in");
}
for (const fragment of [
  "npm run audit:prod",
  "npm run validate:release-policy",
  "npm run validate:evidence",
  "npm run test:evidence",
  "npm run test:templates",
  "npm run test:templates:rollback",
]) {
  if (!qualityWorkflow.includes(fragment)) failures.push(`quality workflow is missing: ${fragment}`);
}

if (failures.length > 0) {
  console.error("Release policy validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release policy validated for create-brass ${manifest.version}.`);
