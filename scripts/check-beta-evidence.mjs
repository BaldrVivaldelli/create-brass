#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = path.resolve(root, process.argv[2] ?? "docs/evidence/beta-readiness-2026-09-20.json");
const tarballPath = process.argv[3] ? path.resolve(root, process.argv[3]) : null;
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];

if (evidence.schemaVersion !== 1 || evidence.kind !== "create-brass-beta-readiness") {
  failures.push("invalid beta evidence schema or kind");
}
if (evidence.status !== "validated-not-published") failures.push("beta evidence status is not the recorded registry state");
if (evidence.source?.repository !== "BaldrVivaldelli/create-brass"
  || evidence.source?.branch !== "main"
  || !/^[a-f0-9]{40}$/.test(evidence.source?.sha ?? "")
  || evidence.source?.stableVersion !== evidence.registry?.latest
  || manifest.name !== "create-brass") {
  failures.push("source identity or stable version is invalid");
}
if (evidence.migration?.pullRequest !== 13
  || !/^https:\/\/github\.com\//.test(evidence.migration?.pullRequestUrl ?? "")
  || evidence.migration?.mergeCommitSha !== evidence.source?.sha
  || evidence.migration?.qualityResult !== "success"
  || !Number.isInteger(evidence.migration?.qualityRunId)
  || !Number.isInteger(evidence.migration?.qualityJobId)
  || !evidence.migration?.claimBoundary?.includes("not independent external production adoption")) {
  failures.push("merged migration evidence or claim boundary is incomplete");
}

const candidate = evidence.candidate;
if (candidate?.version !== "1.3.0-beta.0"
  || candidate?.distTag !== "next"
  || candidate?.runtimeBeta !== "brass-runtime@2.0.0-beta.0"
  || candidate?.templateVariants !== 2
  || candidate?.workflow?.event !== "workflow_dispatch"
  || candidate?.workflow?.validationResult !== "success"
  || !Number.isInteger(candidate?.workflow?.runId)
  || !Number.isInteger(candidate?.workflow?.validationJobId)) {
  failures.push("beta candidate identity or validation workflow is incomplete");
}
if (!Array.isArray(candidate?.validationMatrix)
  || candidate.validationMatrix.length !== 4
  || candidate.validationMatrix.some((entry) => entry?.buildsPassed !== 2 || entry?.buildsTotal !== 2)) {
  failures.push("all four two-template validation modes must pass");
}

const artifact = candidate?.artifact;
const tarball = artifact?.tarball;
if (!Number.isInteger(artifact?.id)
  || artifact?.name !== `create-brass-beta-${candidate?.version}`
  || !Number.isInteger(artifact?.archiveBytes)
  || !/^sha256:[a-f0-9]{64}$/.test(artifact?.archiveDigest ?? "")
  || !Number.isFinite(Date.parse(artifact?.expiresAt))
  || tarball?.filename !== `create-brass-${candidate?.version}.tgz`
  || !Number.isInteger(tarball?.bytes)
  || !Number.isInteger(tarball?.unpackedBytes)
  || tarball?.files !== 32
  || !/^[a-f0-9]{64}$/.test(tarball?.sha256 ?? "")
  || !/^[a-f0-9]{40}$/.test(tarball?.shasum ?? "")
  || !/^sha512-/.test(tarball?.integrity ?? "")) {
  failures.push("retained beta artifact or tarball identity is incomplete");
}
if (tarballPath) {
  if (!existsSync(tarballPath)) {
    failures.push("supplied beta tarball does not exist");
  } else {
    const bytes = readFileSync(tarballPath);
    if (statSync(tarballPath).size !== tarball.bytes) failures.push("beta tarball byte count does not match evidence");
    if (createHash("sha256").update(bytes).digest("hex") !== tarball.sha256) {
      failures.push("beta tarball sha256 does not match evidence");
    }
  }
}

if (evidence.publicationAttempt?.runId !== candidate?.workflow?.runId
  || evidence.publicationAttempt?.environment !== "npm-next"
  || evidence.publicationAttempt?.approvalGranted !== true
  || evidence.publicationAttempt?.preflight !== "npm whoami"
  || evidence.publicationAttempt?.errorCode !== "E401"
  || evidence.publicationAttempt?.result !== "npm-token-unauthorized"
  || evidence.publicationAttempt?.publishStep !== "skipped"
  || evidence.publicationAttempt?.registryMutation !== false) {
  failures.push("failed publication preflight must remain explicit and pre-publish");
}
if (evidence.registry?.latest !== evidence.source?.stableVersion
  || !Number.isFinite(Date.parse(evidence.registry?.checkedAt))
  || evidence.registry?.next !== null
  || evidence.registry?.candidatePublished !== false) {
  failures.push("dated registry snapshot must preserve stable latest and record the absent beta");
}
if (evidence.controls?.mainProtected !== true
  || !["templates", "CodeQL"].every((check) => evidence.controls?.requiredChecks?.includes(check))
  || evidence.controls?.adminsEnforced !== true
  || evidence.controls?.forcePushesAllowed !== false
  || evidence.controls?.deletionsAllowed !== false
  || evidence.controls?.stableAutomaticPublish !== false
  || evidence.controls?.stableEnvironment !== "npm-stable"
  || evidence.controls?.betaEnvironment !== "npm-next"
  || evidence.controls?.environmentReviewerRequired !== true
  || evidence.controls?.npmCli !== "11.5.1"
  || evidence.controls?.provenanceRequested !== true) {
  failures.push("release and branch controls are incomplete");
}
if (evidence.security?.command !== "npm audit --omit=dev --json"
  || evidence.security?.productionDependencies !== 5
  || evidence.security?.productionVulnerabilities !== 0) {
  failures.push("production dependency audit evidence is incomplete");
}
if (!Array.isArray(evidence.limitations) || evidence.limitations.length < 4) {
  failures.push("at least four evidence limitations are required");
}
if (!Array.isArray(evidence.reproduce) || evidence.reproduce.length < 7) {
  failures.push("reproduction commands are incomplete");
}

if (failures.length > 0) {
  console.error("Beta evidence validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Beta readiness evidence validated (${candidate.version}, ${candidate.validationMatrix.length} modes, ` +
  `published at snapshot: no, tarball checked: ${tarballPath ? "yes" : "no"}).`,
);
