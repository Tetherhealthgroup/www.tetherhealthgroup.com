// Lockfile libc guard (WEB-013, R-074): scripts/check-lockfile-libc.mjs must
// fail when a Linux binary entry loses `libc`, and pass on the committed
// lockfile. Synthetic lockfiles are written to a temp dir, never to the repo.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { format } from "prettier";
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

function runWithBaseline(baselineArg, lockfileArg = lockfilePath) {
  return spawnSync(
    process.execPath,
    [script, "--baseline", baselineArg, "--lockfile", lockfileArg],
    { encoding: "utf8" },
  );
}

function writeBaseline(name, content) {
  const path = join(tmp, name);
  writeFileSync(path, content);
  return path;
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
  assert.match(
    result.stdout,
    /ok: 41 of 42 baseline libc entries present and unchanged in .*; 1 no longer in the lockfile \(see notices\)/,
  );
  assert.doesNotMatch(result.stdout, /all still present/);
});

for (const [label, value] of [
  ["null", null],
  ["false", false],
  ["0", 0],
  ["an empty string", ""],
  ["a non-empty string", "x"],
  ["a number", 1],
  ["an empty array", []],
  ["an array", [{ libc: ["glibc"] }]],
]) {
  test(`a baseline entry present as ${label} is lost (exit 1), not removed`, () => {
    const victim = baselineKeys[0];
    const path = writeLockfile("one-not-object.json", (packages) => {
      packages[victim] = value;
    });
    const result = run(path);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /notice: baseline entry no longer/);
    assert.doesNotMatch(result.stdout, /ok:/);
    assert.match(result.stderr, /1 lockfile entry lost/);
    assert.ok(result.stderr.includes(`  ${victim}\n`), result.stderr);
  });
}

test("a baseline key that only exists on Object.prototype is removed, not lost", () => {
  const baselineFile = writeBaseline(
    "proto-baseline.json",
    JSON.stringify({
      constructor: ["glibc"],
      "node_modules/a-linux-x64-gnu": ["glibc"],
    }),
  );
  const lockfileFile = writeBaseline(
    "proto-lock.json",
    JSON.stringify({
      packages: { "node_modules/a-linux-x64-gnu": { libc: ["glibc"] } },
    }),
  );
  const result = runWithBaseline(baselineFile, lockfileFile);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    result.stdout.includes(
      "notice: baseline entry no longer in lockfile: constructor",
    ),
    result.stdout,
  );
});

for (const [label, packages] of [
  ["an empty packages map", {}],
  ["a packages array", []],
]) {
  test(`a lockfile with ${label} exits 2, never ok`, () => {
    const path = join(tmp, "hollow-lock.json");
    writeFileSync(path, JSON.stringify({ packages }));
    const result = run(path);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /ok:/);
    assert.match(
      result.stderr,
      Array.isArray(packages)
        ? /^error: lockfile has no `packages` map/
        : /^error: none of the 42 baseline entries is in the lockfile/,
    );
  });
}

test("a lockfile with no packages map exits 2, never ok", () => {
  const path = join(tmp, "empty-object.json");
  writeFileSync(path, "{}");
  const result = run(path);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /ok:/);
  assert.match(result.stderr, /no `packages` map/);
});

test("an empty baseline exits 2, never ok", () => {
  const result = runWithBaseline(writeBaseline("empty-baseline.json", "{}"));
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /baseline is empty/);
});

test("a changed libc value fails with exit 1, not a notice", () => {
  const victim = baselineKeys[0];
  const swapped = baseline[victim][0] === "glibc" ? "musl" : "glibc";
  const path = writeLockfile("one-changed.json", (packages) => {
    packages[victim].libc = [swapped];
  });
  const result = run(path);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /ok:/);
  assert.ok(
    result.stderr.includes(
      `  ${victim}: ${baseline[victim].join(",")} -> ${swapped}`,
    ),
    result.stderr,
  );
});

test("a reordered libc list is not a change", () => {
  const key = "node_modules/both-linux-x64";
  const baselineFile = writeBaseline(
    "both-baseline.json",
    JSON.stringify({ [key]: ["glibc", "musl"] }),
  );
  const lockfileFile = writeBaseline(
    "both-lock.json",
    JSON.stringify({ packages: { [key]: { libc: ["musl", "glibc"] } } }),
  );
  const result = runWithBaseline(baselineFile, lockfileFile);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const [label, value] of [
  ["an empty array", []],
  ["a string", "glibc"],
  ["null", null],
  ["a number", 1],
  ["an array with a non-string", ["glibc", 1]],
  ["an array with an empty string", [""]],
]) {
  test(`a baseline value that is ${label} exits 2 and names the key`, () => {
    const key = baselineKeys[0];
    const path = writeBaseline(
      "bad-value-baseline.json",
      JSON.stringify({ ...baseline, [key]: value }),
    );
    const result = runWithBaseline(path);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /ok:/);
    assert.ok(
      result.stderr.includes(
        `error: baseline value for ${key} must be a non-empty array of non-empty strings`,
      ),
      result.stderr,
    );
  });
}

test("--write-baseline writes the one-line-per-entry layout of the committed file", () => {
  const source = join(tmp, "small-lock.json");
  const out = join(tmp, "small-baseline.json");
  writeFileSync(
    source,
    JSON.stringify({
      packages: {
        "": {},
        "node_modules/b-linux-x64-musl": { libc: ["musl"] },
        "node_modules/a-linux-x64-gnu": { libc: ["glibc"] },
        "node_modules/no-libc": { os: ["darwin"] },
      },
    }),
  );
  const result = spawnSync(
    process.execPath,
    [script, "--write-baseline", source, "--baseline", out],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(
    readFileSync(out, "utf8"),
    '{\n  "node_modules/a-linux-x64-gnu": ["glibc"],\n  "node_modules/b-linux-x64-musl": ["musl"]\n}\n',
  );
});

// Lockfile keys whose one-value line is exactly `width` characters long,
// without the trailing comma.
function keyForLineWidth(width) {
  // `  "` + key + `": ["glibc"]` is 15 characters around the key.
  return `node_modules/${"x".repeat(width - 15 - "node_modules/".length)}`;
}

test("--write-baseline output is what prettier gives, including lines over 80", async () => {
  // Prettier keeps `"key": [...]` on one line only when it fits in 80
  // columns including the trailing comma; otherwise one value per line.
  const packages = { "": {} };
  for (const [index, width] of [78, 79, 80, 81, 82, 100].entries()) {
    packages[`${keyForLineWidth(width).slice(0, -1)}${index}`] = {
      libc: ["glibc"],
    };
  }
  packages[keyForLineWidth(80).replace("xx", "z1")] = { libc: ["glibc"] };
  packages[keyForLineWidth(81).replace("xx", "z2")] = {
    libc: ["glibc", "musl"],
  };
  packages[keyForLineWidth(80).replace("xx", "zz")] = { libc: ["musl"] };
  const source = join(tmp, "long-lock.json");
  const out = join(tmp, "long-baseline.json");
  writeFileSync(source, JSON.stringify({ packages }));
  const result = spawnSync(
    process.execPath,
    [script, "--write-baseline", source, "--baseline", out],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const written = readFileSync(out, "utf8");
  assert.equal(written, await format(written, { parser: "json" }));
  assert.ok(written.split("\n").some((line) => line.length > 80));
});

test("--write-baseline breaks an over-long entry one value per line", () => {
  const key = keyForLineWidth(90);
  const source = join(tmp, "one-long-lock.json");
  const out = join(tmp, "one-long-baseline.json");
  writeFileSync(
    source,
    JSON.stringify({ packages: { [key]: { libc: ["glibc", "musl"] } } }),
  );
  const result = spawnSync(
    process.execPath,
    [script, "--write-baseline", source, "--baseline", out],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(
    readFileSync(out, "utf8"),
    `{\n  ${JSON.stringify(key)}: [\n    "glibc",\n    "musl"\n  ]\n}\n`,
  );
});

test("the committed baseline is byte-identical to a --write-baseline of the committed lockfile", () => {
  const out = join(tmp, "regenerated-baseline.json");
  const result = spawnSync(
    process.execPath,
    [script, "--write-baseline", lockfilePath, "--baseline", out],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(out, "utf8"), readFileSync(baselinePath, "utf8"));
});

test("--write-baseline refuses a lockfile with no libc entries", () => {
  const source = join(tmp, "no-libc-lock.json");
  const out = join(tmp, "no-libc-baseline.json");
  writeFileSync(
    source,
    JSON.stringify({ packages: { "node_modules/a": { os: ["linux"] } } }),
  );
  const result = spawnSync(
    process.execPath,
    [script, "--write-baseline", source, "--baseline", out],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.ok(
    result.stderr.startsWith(
      `error: lockfile ${source} gives no valid baseline, nothing written: baseline is empty`,
    ),
    result.stderr,
  );
  assert.throws(() => readFileSync(out), { code: "ENOENT" });
});

test("exits 2 on an unreadable lockfile and says which file", () => {
  const missing = join(tmp, "does-not-exist.json");
  const result = run(missing);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /ok:/);
  assert.ok(
    result.stderr.startsWith(`error: cannot read lockfile ${missing}: ENOENT`),
    result.stderr,
  );
});
