#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const validator = path.join(root, "scripts", "check-beta-evidence.mjs");
const committed = JSON.parse(readFileSync(
  path.join(root, "docs", "evidence", "beta-readiness-2026-09-20.json"),
  "utf8",
));
const directory = mkdtempSync(path.join(tmpdir(), "create-brass-beta-evidence-"));

try {
  assert.equal(validate(committed).status, 0, "committed evidence must pass");

  const falsePublication = structuredClone(committed);
  falsePublication.registry.candidatePublished = true;
  assert.equal(validate(falsePublication).status, 1, "unpublished evidence cannot claim publication");

  const movedLatest = structuredClone(committed);
  movedLatest.registry.latest = "1.3.0-beta.0";
  assert.equal(validate(movedLatest).status, 1, "beta evidence cannot move latest");

  const failedValidation = structuredClone(committed);
  failedValidation.candidate.validationMatrix[0].buildsPassed = 1;
  assert.equal(validate(failedValidation).status, 1, "all template modes must pass");

  const mutatedDigest = structuredClone(committed);
  mutatedDigest.candidate.artifact.tarball.sha256 = "not-a-digest";
  assert.equal(validate(mutatedDigest).status, 1, "mutated artifact identity must fail");

  const falseOidcPublication = structuredClone(committed);
  falseOidcPublication.oidcReadiness.registry.candidatePublished = true;
  assert.equal(validate(falseOidcPublication).status, 1, "OIDC validation cannot claim publication");

  const weakenedOidcControls = structuredClone(committed);
  weakenedOidcControls.oidcReadiness.controls.requiredChecks = ["templates", "CodeQL"];
  assert.equal(validate(weakenedOidcControls).status, 1, "current audit protection must remain recorded");

  const mutatedOidcDigest = structuredClone(committed);
  mutatedOidcDigest.oidcReadiness.artifact.tarball.sha256 = "not-a-digest";
  assert.equal(validate(mutatedOidcDigest).status, 1, "current OIDC artifact identity must fail closed");

  console.log("Beta evidence integrity tests passed (8 cases).");
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function validate(evidence) {
  const evidencePath = path.join(directory, `evidence-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, "utf8");
  return spawnSync(process.execPath, [validator, evidencePath], { cwd: root, encoding: "utf8" });
}
