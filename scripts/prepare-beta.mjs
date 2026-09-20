#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const candidate = process.argv[2];
const shouldWrite = process.argv.includes("--write");
const packagePath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);
const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
const lockfile = JSON.parse(readFileSync(lockPath, "utf8"));

if (manifest.version !== lockfile.version || manifest.version !== lockfile.packages?.[""]?.version) {
  fail("package.json and package-lock.json must begin at the same stable version");
}

const stable = parseStable(manifest.version);
const beta = parseBeta(candidate);
if (beta.major !== stable.major || beta.minor !== stable.minor + 1 || beta.patch !== 0) {
  fail(`beta must target the next minor after ${manifest.version}`);
}

if (shouldWrite) {
  manifest.version = candidate;
  lockfile.version = candidate;
  lockfile.packages[""].version = candidate;
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(lockPath, `${JSON.stringify(lockfile, null, 2)}\n`);
}

console.log(`${shouldWrite ? "Prepared" : "Validated"} create-brass@${candidate} from stable ${stable.raw}.`);

function parseStable(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
  if (!match) fail(`stable version is invalid: ${value}`);
  return versionRecord(value, match);
}

function parseBeta(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/.exec(value ?? "");
  if (!match) fail(`beta version must be exact x.y.z-beta.n: ${value}`);
  return { ...versionRecord(value, match), prerelease: Number(match[4]) };
}

function versionRecord(raw, match) {
  return {
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
