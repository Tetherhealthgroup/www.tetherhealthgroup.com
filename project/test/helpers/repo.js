/**
 * Repository text, for the checks that scan every tracked file rather than
 * the build output: public-repository hygiene and published addresses.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./dist.js";

export const repoRoot = join(projectRoot, "..");

const SKIPPED_DIRS = new Set([".git", "node_modules", "dist", ".astro"]);
const SKIPPED_FILES = new Set(["package-lock.json"]);

/** Tracked plus untracked-but-not-ignored files, relative to the repo root. */
export function repoFiles() {
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const files = [...new Set(out.split("\0").filter(Boolean))].sort();
    if (files.length > 0) return files;
  } catch {
    // git unavailable: fall back to walking the tree.
  }
  const found = [];
  const visit = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name))
          visit(join(dir, entry.name), `${prefix}${entry.name}/`);
      } else found.push(`${prefix}${entry.name}`);
    }
  };
  visit(repoRoot, "");
  return found.sort();
}

/** Text of a tracked file, or null for binaries, lockfiles and env files. */
export function repoTextOf(path) {
  const name = path.split("/").pop();
  if (SKIPPED_FILES.has(name) || name.startsWith(".env")) return null;
  let buf;
  try {
    buf = readFileSync(join(repoRoot, path));
  } catch {
    return null; // listed by git but deleted in the working tree
  }
  if (buf.includes(0)) return null;
  return buf.toString("utf8");
}
