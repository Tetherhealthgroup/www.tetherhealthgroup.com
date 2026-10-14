// Lockfile libc guard (WEB-013, R-074): scripts/check-lockfile-libc.mjs must
// fail when a Linux binary entry loses `libc`, and pass on the committed
// lockfile. Synthetic lockfiles are written to a temp dir, never to the repo.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectRoot } from "../helpers/dist.js";

const repoRoot = join(projectRoot, "..");
const script = join(repoRoot, "scripts", "check-lockfile-libc.mjs");
const baselinePath = join(repoRoot, "scripts", "lockfile-libc-baseline.json");
const lockfilePath = join(repoRoot, "package-lock.json");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
const baselineKeys = Object.keys(baseline);

let tmp;
before(() => {
  tmp = mkdtempSync(join(tmpdir(), "web013-libc-"));
});
after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function run(lockfileArg) {
  const args = [script, "--baseline", baselinePath];
  if (lockfileArg) args.push("--lockfile", lockfileArg);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

function writeLockfile(name, mutate) {
  const copy = structuredClone(lockfile);
  mutate(copy.packages);
  const path = join(tmp, name);
  writeFileSync(path, JSON.stringify(copy, null, 2));
  return path;
}

test("baseline records the 42 libc entries from 1ccb7c0", () => {
  assert.equal(baselineKeys.length, 42);
});

test("passes on the committed lockfile (identical to 1ccb7c0)", () => {
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /ok: 42 baseline libc entries/);
});

test("fails on a lockfile copy with exactly one libc removed", () => {
  const victim = baselineKeys[0];
  const path = writeLockfile("one-removed.json", (packages) => {
    delete packages[victim].libc;
  });
  const result = run(path);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /1 lockfile entry lost/);
  const listed = result.stderr
    .split("\n")
    .filter((line) => line.startsWith("  node_modules/"));
  assert.deepEqual(listed, [`  ${victim}`]);
});

test("a baseline entry removed from the lockfile is a notice, not a failure", () => {
  const gone = baselineKeys[1];
  const path = writeLockfile("one-dropped.json", (packages) => {
    delete packages[gone];
  });
  const result = run(path);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    result.stdout.includes(
      `notice: baseline entry no longer in lockfile: ${gone}`,
    ),
  );
});

test("exits 2 on an unreadable lockfile", () => {
  const result = run(join(tmp, "does-not-exist.json"));
  assert.equal(result.status, 2);
});
