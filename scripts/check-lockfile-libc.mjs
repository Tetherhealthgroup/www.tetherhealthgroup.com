#!/usr/bin/env node
// Lockfile libc guard (WEB-013, R-074).
//
// npm 10.9.8 has been seen to drop the `libc` field from optional Linux native
// binary entries during `npm audit fix` / `npm install`. Without `libc`, npm
// stops choosing glibc vs musl binaries correctly on Linux. This script fails
// when an entry that has `libc` in the committed BASELINE has lost it in the
// current lockfile.
//
// Baseline: scripts/lockfile-libc-baseline.json, a committed snapshot of
// `{ "<lockfile key>": ["glibc"|"musl", ...] }` taken from the lockfile at
// 1ccb7c0 (WEB-008). It is a file, not `git show`, so it works on a shallow CI
// checkout and offline. Node built-ins only.
//
// Baseline entry that no longer exists in the lockfile (package dropped or
// renamed): reported as a NOTICE, exit code unaffected. The guard is about a
// field disappearing from an entry that is still installed; a removed package
// has no binary left to mis-select. Regenerate the baseline to clear notices.
//
// Usage:
//   node scripts/check-lockfile-libc.mjs [--lockfile <path>] [--baseline <path>]
//   node scripts/check-lockfile-libc.mjs --write-baseline <source-lockfile> [--baseline <path>]
//
// Exit codes: 0 ok, 1 libc lost, 2 usage or unreadable/invalid input.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultLockfile = join(here, "..", "package-lock.json");
const defaultBaseline = join(here, "lockfile-libc-baseline.json");

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot read ${label} ${path}: ${error.message}`);
  }
}

function libcOf(entry) {
  return Array.isArray(entry?.libc) && entry.libc.length > 0
    ? [...entry.libc]
    : null;
}

/** key -> libc[] for every node_modules entry that has libc. Sorted by key. */
export function snapshotLibc(lockfile) {
  const packages = lockfile?.packages;
  if (typeof packages !== "object" || packages === null) {
    throw new Error("lockfile has no `packages` map (need lockfileVersion 2+)");
  }
  const out = {};
  for (const key of Object.keys(packages).sort()) {
    if (!key.includes("node_modules/")) continue;
    const libc = libcOf(packages[key]);
    if (libc) out[key] = libc;
  }
  return out;
}

/** Compare a baseline snapshot with a lockfile. Pure; returns the findings. */
export function compareLibc(baseline, lockfile) {
  const packages = lockfile?.packages ?? {};
  const lost = [];
  const removed = [];
  const changed = [];
  for (const [key, baseLibc] of Object.entries(baseline)) {
    const entry = packages[key];
    if (!entry) {
      removed.push(key);
      continue;
    }
    const now = libcOf(entry);
    if (!now) lost.push(key);
    else if (JSON.stringify(now) !== JSON.stringify(baseLibc)) {
      changed.push(`${key}: ${baseLibc.join(",")} -> ${now.join(",")}`);
    }
  }
  return { lost, removed, changed, checked: Object.keys(baseline).length };
}

function parseArgs(argv) {
  const args = { lockfile: defaultLockfile, baseline: defaultBaseline };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!["--lockfile", "--baseline", "--write-baseline"].includes(flag)) {
      throw new Error(`unknown argument: ${flag}`);
    }
    if (value === undefined) throw new Error(`${flag} needs a value`);
    args[flag.slice(2).replace("-b", "B")] = resolve(value);
    i += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.writeBaseline) {
    const snapshot = snapshotLibc(readJson(args.writeBaseline, "lockfile"));
    writeFileSync(args.baseline, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(
      `wrote ${Object.keys(snapshot).length} entries to ${args.baseline}`,
    );
    return 0;
  }

  const baseline = readJson(args.baseline, "baseline");
  const result = compareLibc(baseline, readJson(args.lockfile, "lockfile"));

  for (const key of result.removed) {
    console.log(`notice: baseline entry no longer in lockfile: ${key}`);
  }
  for (const line of result.changed) {
    console.log(`notice: libc value changed: ${line}`);
  }
  if (result.lost.length > 0) {
    console.error(
      `FAIL: ${result.lost.length} lockfile entr${result.lost.length === 1 ? "y" : "ies"} lost the "libc" field that the baseline records:`,
    );
    for (const key of result.lost) console.error(`  ${key}`);
    console.error(
      "Restore the field (do not hand-edit blindly: compare with `npm view <pkg>@<version> libc`). Do not regenerate the baseline to silence this.",
    );
    return 1;
  }
  console.log(
    `ok: ${result.checked} baseline libc entries all still present in ${args.lockfile}`,
  );
  return 0;
}

// Run only when executed directly, so the test can import the pure functions.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 2;
  }
}
