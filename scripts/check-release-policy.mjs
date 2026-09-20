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
  "npx semantic-release",
]) {
  if (!stableWorkflow.includes(fragment)) failures.push(`stable release workflow is missing: ${fragment}`);
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
