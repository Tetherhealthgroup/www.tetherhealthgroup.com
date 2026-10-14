#!/usr/bin/env node
// Lockfile libc guard (WEB-013, R-074; hardened in WEB-016).
//
// npm 10.9.8 has been seen to drop the `libc` field from optional Linux native
// binary entries during `npm audit fix` / `npm install`. Without `libc`, npm
// stops choosing glibc vs musl binaries correctly on Linux. This script fails
// when an entry that has `libc` in the committed BASELINE has lost it (an entry
// that is present but is not a plain object counts as lost), or has a
// different libc value, in the current lockfile.
//
// Baseline: scripts/lockfile-libc-baseline.json, a committed snapshot of
// `{ "<lockfile key>": ["glibc"|"musl", ...] }` taken from the lockfile at
// 1ccb7c0 (WEB-008). It is a file, not `git show`, so it works on a shallow CI
// checkout and offline. Node built-ins only. Every value must be a non-empty
// array of non-empty strings; anything else (including `[]`) is exit 2.
//
// Not baselined, on purpose (WEB-019, checked 2026-10-14): the 13 Linux binary
// entries with no `libc` in the lockfile, namely @esbuild/linux-{arm,arm64,
// ia32,loong64,mips64el,ppc64,riscv64,s390x,x64} 0.28.2,
// @rolldown/binding-linux-arm-gnueabihf 1.2.6,
// @tailwindcss/oxide-linux-arm-gnueabihf 4.3.3 and
// lightningcss-linux-arm-gnueabihf 1.32.0 and 1.33.0. The registry publishes
// no `libc` for any of those exact versions (`npm view <name>@<version> libc
// --json` prints nothing, and the registry's version document has no `libc`
// key). The lockfile therefore mirrors the registry and npm has not stripped
// it from these entries, so there is no field to lose and nothing to guard.
// When any of these is bumped, re-run `npm view <name>@<new version> libc
// --json` (always `npm view`, the full packument: the abbreviated metadata npm
// installs from omits `libc`, seen even for the control package that has it).
// If it prints a value, confirm the lockfile entry now carries that `libc` (if
// not, npm stripped it; restore the registry value first), run this check
// clean, then --write-baseline, and confirm the reported count rose by one, in
// a reviewed commit (a baseline entry needs a value to compare, so there is
// nothing to add before then).
//
// Baseline entry that no longer exists in the lockfile (package dropped or
// renamed): reported as a NOTICE, exit code unaffected. The guard is about a
// field disappearing from an entry that is still installed; a removed package
// has no binary left to mis-select. If NONE of the baseline entries is in the
// lockfile, that is exit 2, not a pass: it means the wrong lockfile or an
// emptied `packages` map, and would otherwise check nothing. A baseline entry
// whose libc VALUE changed (for example glibc to musl) is a FAILURE (exit 1): a
// wrong value mis-selects a binary just as a lost one does. Order is ignored
// (["glibc","musl"] equals ["musl","glibc"]). If the change is genuine
// upstream, confirm it with `npm view <pkg>@<version> libc` and regenerate the
// baseline in a reviewed commit.
//
// Regenerating the baseline (--write-baseline): do it only after a clean run
// (exit 0) of this check on that same lockfile. Regenerating from a lockfile
// that has lost libc silently drops the guard for those entries. The written
// file is byte-identical to what prettier (default printWidth 80) gives for
// ASCII keys (npm package names always are; prettier counts wide characters
// as two columns): one line per entry, except that an entry whose line would
// exceed 80 columns (trailing comma included) puts each libc value on its own
// line, as prettier does. --write-baseline refuses (exit 2) a lockfile with no
// libc entries.
// An empty, non-object or malformed baseline, or a lockfile without a
// `packages` object, is an error (exit 2), never a pass.
//
// Usage:
//   node scripts/check-lockfile-libc.mjs [--lockfile <path>] [--baseline <path>]
//   node scripts/check-lockfile-libc.mjs --write-baseline <source-lockfile> [--baseline <path>]
//
// Exit codes: 0 ok, 1 libc lost (including an entry that is present but not a
// plain object) or changed, 2 usage or unreadable/invalid input.

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

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function libcOf(entry) {
  return Array.isArray(entry?.libc) && entry.libc.length > 0
    ? [...entry.libc]
    : null;
}

function packagesOf(lockfile) {
  const packages = lockfile?.packages;
  if (
    typeof packages !== "object" ||
    packages === null ||
    Array.isArray(packages)
  ) {
    throw new Error("lockfile has no `packages` map (need lockfileVersion 2+)");
  }
  return packages;
}

/** Throws unless baseline is a non-empty { key: non-empty string[] } map. */
function validateBaseline(baseline) {
  if (
    typeof baseline !== "object" ||
    baseline === null ||
    Array.isArray(baseline) ||
    Object.keys(baseline).length === 0
  ) {
    throw new Error(
      "baseline is empty or not an object; an empty baseline checks nothing",
    );
  }
  for (const [key, libc] of Object.entries(baseline)) {
    const valid =
      Array.isArray(libc) &&
      libc.length > 0 &&
      libc.every((value) => typeof value === "string" && value.length > 0);
    if (!valid) {
      throw new Error(
        `baseline value for ${key} must be a non-empty array of non-empty strings, got ${JSON.stringify(libc)}`,
      );
    }
  }
}

function sameLibc(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

/** key -> libc[] for every node_modules entry that has libc. Sorted by key. */
function snapshotLibc(lockfile) {
  const packages = packagesOf(lockfile);
  const out = {};
  for (const key of Object.keys(packages).sort()) {
    if (!key.includes("node_modules/")) continue;
    const libc = libcOf(packages[key]);
    if (libc) out[key] = libc;
  }
  return out;
}

/** Compare a baseline snapshot with a lockfile. Pure; returns the findings. */
function compareLibc(baseline, lockfile) {
  const packages = packagesOf(lockfile);
  validateBaseline(baseline);
  const lost = [];
  const removed = [];
  const changed = [];
  for (const [key, baseLibc] of Object.entries(baseline)) {
    // Only a key that is absent from `packages` is "removed". An entry that is
    // present but is not a plain object (null, false, 0, "", an array, a
    // string, a number) is a corrupted entry, so it counts as "lost".
    if (!Object.hasOwn(packages, key)) {
      removed.push(key);
      continue;
    }
    const entry = packages[key];
    const now = isPlainObject(entry) ? libcOf(entry) : null;
    if (!now) lost.push(key);
    else if (!sameLibc(now, baseLibc)) {
      changed.push(
        `${key}: ${JSON.stringify(baseLibc)} -> ${JSON.stringify(now)}`,
      );
    }
  }
  const checked = Object.keys(baseline).length;
  if (removed.length === checked) {
    throw new Error(
      `none of the ${checked} baseline entries is in the lockfile; wrong lockfile, or its \`packages\` map was emptied`,
    );
  }
  return { lost, removed, changed, checked };
}

const FLAGS = {
  "--lockfile": "lockfile",
  "--baseline": "baseline",
  "--write-baseline": "writeBaseline",
};

function parseArgs(argv) {
  const args = { lockfile: defaultLockfile, baseline: defaultBaseline };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!Object.hasOwn(FLAGS, flag)) {
      throw new Error(`unknown argument: ${flag}`);
    }
    if (value === undefined) throw new Error(`${flag} needs a value`);
    args[FLAGS[flag]] = resolve(value);
    i += 1;
  }
  return args;
}

const PRINT_WIDTH = 80; // prettier's default; no prettier config here sets one

/**
 * Same layout prettier gives the committed file: one line per entry, or one
 * libc value per line when the entry (with its trailing comma) is too wide.
 */
function formatBaseline(snapshot) {
  const entries = Object.entries(snapshot);
  const lines = entries.map(([key, libc], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    const values = libc.map((value) => JSON.stringify(value));
    const oneLine = `  ${JSON.stringify(key)}: [${values.join(", ")}]${comma}`;
    if (oneLine.length <= PRINT_WIDTH) return oneLine;
    return `  ${JSON.stringify(key)}: [\n${values.map((v) => `    ${v}`).join(",\n")}\n  ]${comma}`;
  });
  return lines.length === 0 ? "{}\n" : `{\n${lines.join("\n")}\n}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.writeBaseline) {
    const source = readJson(args.writeBaseline, "lockfile");
    let snapshot;
    try {
      snapshot = snapshotLibc(source);
    } catch (error) {
      throw new Error(
        `lockfile ${args.writeBaseline} is not usable, nothing written: ${error.message}`,
      );
    }
    try {
      validateBaseline(snapshot);
    } catch (error) {
      throw new Error(
        `lockfile ${args.writeBaseline} gives no valid baseline, nothing written: ${error.message}`,
      );
    }
    writeFileSync(args.baseline, formatBaseline(snapshot));
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
  const describeCount = (count) =>
    `${count} lockfile entr${count === 1 ? "y" : "ies"}`;
  if (result.lost.length > 0) {
    console.error(
      `FAIL: ${describeCount(result.lost.length)} lost the "libc" field that the baseline records:`,
    );
    for (const key of result.lost) console.error(`  ${key}`);
  }
  if (result.changed.length > 0) {
    console.error(
      `FAIL: ${describeCount(result.changed.length)} changed the "libc" value that the baseline records (baseline -> lockfile):`,
    );
    for (const line of result.changed) console.error(`  ${line}`);
  }
  if (result.lost.length > 0 || result.changed.length > 0) {
    console.error(
      "Restore the field or value (do not hand-edit blindly: compare with `npm view <pkg>@<version> libc`). Do not regenerate the baseline to silence this.",
    );
    return 1;
  }
  const present = result.checked - result.removed.length;
  console.log(
    result.removed.length === 0
      ? `ok: ${result.checked} baseline libc entries all still present in ${args.lockfile}`
      : `ok: ${present} of ${result.checked} baseline libc entries present and unchanged in ${args.lockfile}; ${result.removed.length} no longer in the lockfile (see notices)`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 2;
}
