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

const oidc = evidence.oidcReadiness;
const oidcArtifact = oidc?.artifact;
const oidcTarball = oidcArtifact?.tarball;
if (!Number.isFinite(Date.parse(oidc?.recordedAt))
  || oidc?.source?.repository !== "BaldrVivaldelli/create-brass"
  || oidc?.source?.branch !== "main"
  || !/^[a-f0-9]{40}$/.test(oidc?.source?.sha ?? "")
  || oidc?.source?.pullRequest !== 18
  || oidc?.authentication?.mode !== "npm-trusted-publishing-oidc"
  || oidc?.authentication?.workflow !== "publish-beta.yml"
  || oidc?.authentication?.node !== "22"
  || oidc?.authentication?.npmCli !== "11.5.1"
  || oidc?.authentication?.environment !== "npm-next"
  || oidc?.authentication?.idTokenPermission !== "publish-job-only"
  || oidc?.authentication?.repositoryTokenSecretRequired !== false
  || oidc?.authentication?.trustedPublisherConfiguration !== "requires-package-owner-confirmation") {
  failures.push("OIDC source and trusted-publishing prerequisites are incomplete");
}
if (oidc?.validation?.runId !== 35533454283
  || oidc?.validation?.event !== "workflow_dispatch"
  || oidc?.validation?.version !== candidate?.version
  || oidc?.validation?.publishRequested !== false
  || oidc?.validation?.validationJobId !== 106138165503
  || oidc?.validation?.validationResult !== "success"
  || oidc?.validation?.publishJobId !== 106138375689
  || oidc?.validation?.publishResult !== "skipped-by-input"
  || oidc?.validation?.productionAuditResult !== "success"
  || oidc?.validation?.registryMutation !== false) {
  failures.push("OIDC validation run must remain successful, non-publishing, and immutable");
}
if (oidcArtifact?.id !== 10612356957
  || oidcArtifact?.name !== `create-brass-beta-${candidate?.version}`
  || oidcArtifact?.archiveBytes !== 17430
  || !/^sha256:[a-f0-9]{64}$/.test(oidcArtifact?.archiveDigest ?? "")
  || !Number.isFinite(Date.parse(oidcArtifact?.expiresAt))
  || oidcTarball?.filename !== `create-brass-${candidate?.version}.tgz`
  || oidcTarball?.bytes !== 17248
  || oidcTarball?.unpackedBytes !== 68181
  || oidcTarball?.files !== 32
  || !/^[a-f0-9]{64}$/.test(oidcTarball?.sha256 ?? "")
  || !/^[a-f0-9]{40}$/.test(oidcTarball?.shasum ?? "")
  || !/^sha512-/.test(oidcTarball?.integrity ?? "")) {
  failures.push("OIDC beta artifact or tarball identity is incomplete");
}
if (oidc?.controls?.mainProtected !== true
  || !["templates", "audit", "CodeQL"].every((check) => oidc?.controls?.requiredChecks?.includes(check))
  || oidc?.controls?.adminsEnforced !== true
  || oidc?.controls?.forcePushesAllowed !== false
  || oidc?.controls?.deletionsAllowed !== false
  || oidc?.controls?.protectedBranchesOnly !== true
  || oidc?.controls?.environmentReviewerRequired !== true) {
  failures.push("current OIDC branch and environment controls are incomplete");
}
if (!Number.isFinite(Date.parse(oidc?.registry?.checkedAt))
  || oidc?.registry?.latest !== evidence.source?.stableVersion
  || oidc?.registry?.next !== null
  || oidc?.registry?.candidatePublished !== false
  || !oidc?.claimBoundary?.includes("not publication")) {
  failures.push("OIDC registry snapshot or claim boundary is invalid");
}
if (tarballPath) {
  if (!existsSync(tarballPath)) {
    failures.push("supplied beta tarball does not exist");
  } else {
    const bytes = readFileSync(tarballPath);
    if (statSync(tarballPath).size !== oidcTarball?.bytes) failures.push("beta tarball byte count does not match current evidence");
    if (createHash("sha256").update(bytes).digest("hex") !== oidcTarball?.sha256) {
      failures.push("beta tarball sha256 does not match current evidence");
    }
  }
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
  `OIDC candidate validated: yes, published at snapshot: no, tarball checked: ${tarballPath ? "yes" : "no"}).`,
);
